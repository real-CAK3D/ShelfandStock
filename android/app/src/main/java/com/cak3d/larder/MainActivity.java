package com.cak3d.larder;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Point;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.GeolocationPermissions;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

// Shelf & Stock runs entirely from files bundled in the APK, served on a virtual https origin so
// ES modules, localStorage and the service-worker-free offline mode all behave like the web.
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String BG = "#2A180D";
    private static final int REQ_FILE = 1, REQ_CAM = 2, REQ_LOC = 3, REQ_SHOT = 4, REQ_PICK = 5;

    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest pendingPerm;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor(BG));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor(BG));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);

        // debug builds can be inspected from chrome://inspect
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        web.addJavascriptInterface(new Bridge(), "LarderNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"appassets.androidplatform.net".equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open("www" + path);
                    return new WebResourceResponse(mime(path), mime(path).startsWith("text") || path.endsWith(".js") || path.endsWith(".json") ? "utf-8" : null, in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // "Find stores near me" and "tell the house when I'm at a store"
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    cb.invoke(origin, true, false);
                } else {
                    geoCb = cb; geoOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            } else {
                                pendingPerm = request;
                                requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAM);
                            }
                            return;
                        }
                    }
                    request.deny();
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                chooser = params;
                // <input capture> = the camera; an image input without it = the photo gallery; anything else = files
                boolean images = false;
                for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image")) images = true;
                if (images && params.isCaptureEnabled()) {
                    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{ Manifest.permission.CAMERA }, REQ_SHOT); return true; }
                    return openCamera();
                }
                if (images) return openGallery(params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(params.createIntent(), REQ_FILE); } catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        readShare(getIntent());
        if (state != null) web.restoreState(state);
        else web.loadUrl(ORIGIN + "/index.html");
    }

    // ---- things shared into the app (receipts from the store apps, screenshots, text) ----
    // Held here until the page asks for them, so it works whether the app was open or not.
    private String sharedJson = null;

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (readShare(intent) && web != null) web.evaluateJavascript("window.larderShared && window.larderShared()", null);
    }

    private boolean readShare(Intent in) {
        if (in == null) return false;
        String a = in.getAction();
        if (!Intent.ACTION_SEND.equals(a) && !Intent.ACTION_SEND_MULTIPLE.equals(a)) return false;
        try {
            JSONObject o = new JSONObject();
            JSONArray imgs = new JSONArray();
            CharSequence text = in.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text != null) o.put("text", text.toString());
            String subject = in.getStringExtra(Intent.EXTRA_SUBJECT);
            if (subject != null) o.put("subject", subject);
            java.util.ArrayList<Uri> uris = new java.util.ArrayList<>();
            if (Intent.ACTION_SEND.equals(a)) { Uri u = in.getParcelableExtra(Intent.EXTRA_STREAM); if (u != null) uris.add(u); }
            else { java.util.ArrayList<Uri> l = in.getParcelableArrayListExtra(Intent.EXTRA_STREAM); if (l != null) uris.addAll(l); }
            for (Uri u : uris) {
                if (imgs.length() >= 4) break;
                try (InputStream is = getContentResolver().openInputStream(u)) {
                    Bitmap bmp = BitmapFactory.decodeStream(is);
                    if (bmp == null) continue;
                    // keep it readable but not huge: long side at most 2400 px
                    float k = Math.min(1f, 2400f / Math.max(bmp.getWidth(), bmp.getHeight()));
                    if (k < 1f) bmp = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * k), Math.round(bmp.getHeight() * k), true);
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.JPEG, 90, bo);
                    imgs.put(Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                } catch (Exception ignored) { }
            }
            o.put("images", imgs);
            if (imgs.length() == 0 && text == null) return false;
            sharedJson = o.toString();
            return true;
        } catch (Exception e) { return false; }
    }

    private static String mime(String path) {
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".webmanifest")) return "application/manifest+json";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".svg")) return "image/svg+xml";
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        String m = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m != null ? m : "application/octet-stream";
    }

    private TextRecognizer recognizer;

    // Hand OCR results back to the page (base64 so any text survives the trip).
    private void ocrDone(int id, boolean ok, String json) {
        final String b64 = Base64.encodeToString(json.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
        runOnUiThread(() -> web.evaluateJavascript("window.__nativeOcrDone && window.__nativeOcrDone(" + id + "," + ok + ",'" + b64 + "')", null));
    }

    private BarcodeScanner barcodeReader;

    private void codeDone(int id, boolean ok, String value) {
        final String b64 = Base64.encodeToString((value == null ? "" : value).getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
        runOnUiThread(() -> web.evaluateJavascript("window.__nativeCodeDone && window.__nativeCodeDone(" + id + "," + ok + ",'" + b64 + "')", null));
    }

    // Native helpers the web app uses when present (window.LarderNative).
    private class Bridge {
        // Whatever was shared into the app since the page last asked (JSON: images as base64 JPEG, text), once.
        @JavascriptInterface
        public String takeShared() { String s = sharedJson; sharedJson = null; return s == null ? "" : s; }

        // Google's own barcode scanner screen: point at any barcode, any angle. No camera permission needed.
        @JavascriptInterface
        public void scanCode(final int id) {
            runOnUiThread(() -> {
                try {
                    GmsBarcodeScannerOptions opts = new GmsBarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_CODE_128, Barcode.FORMAT_QR_CODE)
                        .enableAutoZoom().build();
                    GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(MainActivity.this, opts);
                    scanner.startScan()
                        .addOnSuccessListener(b -> codeDone(id, true, b.getRawValue()))
                        .addOnCanceledListener(() -> codeDone(id, false, "cancelled"))
                        .addOnFailureListener(e -> codeDone(id, false, "failed"));
                } catch (Throwable t) { codeDone(id, false, "failed"); }
            });
        }

        // Barcodes in a photo (ML Kit): returns the first product barcode it finds.
        @JavascriptInterface
        public void readBarcode(final int id, final String jpegB64) {
            new Thread(() -> {
                try {
                    byte[] bytes = Base64.decode(jpegB64, Base64.DEFAULT);
                    Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bmp == null) { codeDone(id, false, ""); return; }
                    if (barcodeReader == null) barcodeReader = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8).build());
                    barcodeReader.process(InputImage.fromBitmap(bmp, 0))
                        .addOnSuccessListener(list -> codeDone(id, !list.isEmpty(), list.isEmpty() ? "" : list.get(0).getRawValue()))
                        .addOnFailureListener(e -> codeDone(id, false, ""));
                } catch (Throwable t) { codeDone(id, false, ""); }
            }).start();
        }

        // Read text in a photo with Google ML Kit (on the phone, offline). Returns every line with its
        // corner points so the page can rebuild receipt rows (item on the left, price on the right).
        @JavascriptInterface
        public void recognizeText(final int id, final String jpegB64) {
            new Thread(() -> {
                try {
                    byte[] bytes = Base64.decode(jpegB64, Base64.DEFAULT);
                    Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bmp == null) { ocrDone(id, false, "[]"); return; }
                    if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    recognizer.process(InputImage.fromBitmap(bmp, 0))
                        .addOnSuccessListener(result -> {
                            JSONArray out = new JSONArray();
                            try {
                                for (Text.TextBlock block : result.getTextBlocks())
                                    for (Text.Line line : block.getLines()) {
                                        Point[] c = line.getCornerPoints();
                                        if (c == null || c.length < 4) continue;
                                        JSONObject o = new JSONObject();
                                        o.put("t", line.getText());
                                        o.put("x0", c[0].x); o.put("y0", c[0].y); o.put("x1", c[1].x); o.put("y1", c[1].y);
                                        o.put("x3", c[3].x); o.put("y3", c[3].y);
                                        out.put(o);
                                    }
                            } catch (Exception ignored) { }
                            ocrDone(id, true, out.toString());
                        })
                        .addOnFailureListener(e -> ocrDone(id, false, "[]"));
                } catch (Throwable t) { ocrDone(id, false, "[]"); }
            }).start();
        }

        // CORS-free GET for APIs that don't send CORS headers; result returns base64 to JS.
        @JavascriptInterface
        public void fetch(final int id, final String url) {
            new Thread(() -> {
                boolean ok = false; String b64 = "";
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(10000); c.setReadTimeout(15000);
                    c.setRequestProperty("User-Agent", "ShelfAndStock/1.1 (Android; kitchen inventory app)");
                    c.setRequestProperty("Accept", "application/json");
                    if (c.getResponseCode() < 400) {
                        InputStream in = c.getInputStream();
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        byte[] buf = new byte[16384]; int n;
                        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                        b64 = Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                        ok = true;
                    }
                    c.disconnect();
                } catch (Exception ignored) { }
                final String js = "window.__nativeFetchDone && window.__nativeFetchDone(" + id + "," + ok + ",'" + b64 + "')";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        // Background notifications: where to look, who "me" is, and which kinds to show.
        @JavascriptInterface
        public void configureNotices(String url, String key, String code, String me, String kinds) {
            android.content.SharedPreferences p = NoticeWorker.prefs(MainActivity.this);
            boolean newCode = !code.equals(p.getString("code", ""));
            android.content.SharedPreferences.Editor e = p.edit().putString("url", url).putString("key", key).putString("code", code).putString("me", me).putString("kinds", kinds);
            if (newCode) e.putLong("lastId", -1).putString("trips", "[]");
            e.apply();
            NoticeWorker.schedule(MainActivity.this);
            if (!code.isEmpty() && !p.getBoolean("askedNotify", false)) { p.edit().putBoolean("askedNotify", true).apply(); requestNotifications(); }
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 4));
        }

        // Home-screen widget contents (sent by the app whenever the kitchen changes).
        @JavascriptInterface
        public void updateWidget(String json) {
            NoticeWorker.prefs(MainActivity.this).edit().putString("widget", json).apply();
            WidgetProvider.refresh(MainActivity.this);
        }

        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, "Share list")));
        }

        // Save a backup file into Downloads.
        @JavascriptInterface
        public boolean saveFile(String name, String text) {
            try {
                byte[] data = text.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(data); }
                } else {
                    File f = new File(getExternalFilesDir(null), name);
                    try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads: " + name, Toast.LENGTH_LONG).show());
                return true;
            } catch (Exception e) { return false; }
        }
    }

    // ---- photos: the real camera for "take a picture", the photo picker for "gallery" ----
    private WebChromeClient.FileChooserParams chooser;
    private Uri shotUri;

    private boolean openCamera() {
        try {
            File dir = new File(getCacheDir(), "shots"); dir.mkdirs();
            File f = new File(dir, "shot-" + System.currentTimeMillis() + ".jpg");
            shotUri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, shotUri);
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(i, REQ_SHOT);
            return true;
        } catch (Exception e) {
            // no camera app: fall back to the gallery rather than doing nothing
            return openGallery(false);
        }
    }

    private boolean openGallery(boolean multiple) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 33) {
                i = new Intent(MediaStore.ACTION_PICK_IMAGES);
                if (multiple) i.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, 3);
            } else {
                i = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                if (multiple) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
            startActivityForResult(i, REQ_PICK);
            return true;
        } catch (ActivityNotFoundException e) {
            try { startActivityForResult(chooser.createIntent(), REQ_FILE); return true; } catch (Exception e2) { if (fileCb != null) fileCb.onReceiveValue(null); fileCb = null; return false; }
        }
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req == REQ_FILE && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCb = null;
            return;
        }
        if (req == REQ_SHOT && fileCb != null) {
            fileCb.onReceiveValue(result == RESULT_OK && shotUri != null ? new Uri[]{ shotUri } : null);
            fileCb = null;
            return;
        }
        if (req == REQ_PICK && fileCb != null) {
            Uri[] got = null;
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = Math.min(3, data.getClipData().getItemCount());
                    got = new Uri[n];
                    for (int k = 0; k < n; k++) got[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) got = new Uri[]{ data.getData() };
            }
            fileCb.onReceiveValue(got);
            fileCb = null;
            return;
        }
        super.onActivityResult(req, result, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] grants) {
        if (req == REQ_SHOT) {
            boolean ok = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
            if (ok) openCamera();
            else { Toast.makeText(this, "Camera permission is needed to take pictures", Toast.LENGTH_LONG).show(); if (fileCb != null) fileCb.onReceiveValue(null); fileCb = null; }
            return;
        }
        if (req == REQ_LOC && geoCb != null) {
            boolean ok = false;
            for (int g : grants) if (g == PackageManager.PERMISSION_GRANTED) ok = true;
            geoCb.invoke(geoOrigin, ok, false);
            geoCb = null;
            return;
        }
        if (req == REQ_CAM && pendingPerm != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) pendingPerm.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else pendingPerm.deny();
            pendingPerm = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // Let the web app close sheets/overlays first; leave the app only when it has nothing to close.
    private void handleBack() {
        web.evaluateJavascript("window.larderBack ? window.larderBack() : false", v -> { if (!"true".equals(v)) finish(); });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { handleBack(); }
}
