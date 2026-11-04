package com.cak3d.larder;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;

// A store's own website, opened for the person to look something up. It gets no bridge to the app: the only
// thing that comes back is an aisle the person tapped, and only the short aisle numbers are read from the page.
public class StorePageActivity extends Activity {
    static final String EXTRA_URL = "url", EXTRA_TITLE = "title", EXTRA_AISLE = "aisle";
    private static final String BAR = "#2A180D", INK = "#FBF5EA";
    // "Aisle 7", "Aisle: A12", "aisle 12B", plus the "A12" that follows it on a label's next line
    private static final String FIND = "(function(){var t=(document.body&&document.body.innerText)||'',o=[],m,"
        + "r=/\\baisle\\b\\s*[:#.]?\\s*([A-Za-z]?\\d{1,3}[A-Za-z]?)\\b/gi;"
        + "while((m=r.exec(t))&&o.length<40){var a=m[1].toUpperCase();if(o.indexOf(a)<0)o.push(a);}return o;})()";

    private WebView web;
    private TextView status;
    private LinearLayout choices;
    private String shown = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable scan = new Runnable() {
        @Override public void run() {
            if (web == null) return;
            web.evaluateJavascript(FIND, StorePageActivity.this::showAisles);
            handler.postDelayed(this, 1500); // these sites fill in their results after the page has loaded
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        String url = getIntent().getStringExtra(EXTRA_URL);
        if (url == null || !url.startsWith("https://")) { finish(); return; }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor(BAR));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        int pad = dp(8);
        top.setPadding(pad, pad, pad, pad);
        Button close = new Button(this);
        close.setText("✕");
        close.setOnClickListener(v -> finish());
        top.addView(close, new LinearLayout.LayoutParams(dp(52), dp(44)));
        TextView title = new TextView(this);
        title.setText(getIntent().getStringExtra(EXTRA_TITLE));
        title.setTextColor(Color.parseColor(INK));
        title.setTextSize(16);
        title.setSingleLine(true);
        title.setPadding(pad, 0, 0, 0);
        top.addView(title);
        root.addView(top);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                // stay on the web: links that try to jump into another app or a local file go nowhere
                String scheme = req.getUrl().getScheme();
                return !"https".equals(scheme) && !"http".equals(scheme);
            }
        });
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1f));

        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setPadding(dp(12), pad, dp(12), pad);
        status = new TextView(this);
        status.setTextColor(Color.parseColor(INK));
        status.setTextSize(14);
        status.setText("Open the product. An aisle shows up here when the page lists one.");
        bottom.addView(status);
        HorizontalScrollView scroll = new HorizontalScrollView(this);
        choices = new LinearLayout(this);
        scroll.addView(choices, new ViewGroup.LayoutParams(-2, -2));
        bottom.addView(scroll);
        root.addView(bottom);

        setContentView(root);
        web.loadUrl(url);
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void showAisles(String json) {
        if (json == null || json.equals(shown) || choices == null) return;
        shown = json;
        choices.removeAllViews();
        try {
            JSONArray found = new JSONArray(json);
            int n = found.length();
            status.setText(n == 0 ? "Open the product. An aisle shows up here when the page lists one."
                : n == 1 ? "Found on this page. Tap to save it."
                : "This page lists several. Open the product you want, or tap the right one.");
            for (int i = 0; i < n && i < 12; i++) {
                final String aisle = found.getString(i);
                Button b = new Button(this);
                b.setAllCaps(false);
                b.setText("Aisle " + aisle);
                b.setOnClickListener(v -> { setResult(RESULT_OK, new Intent().putExtra(EXTRA_AISLE, aisle)); finish(); });
                choices.addView(b);
            }
        } catch (Exception ignored) { }
    }

    @Override protected void onResume() { super.onResume(); handler.removeCallbacks(scan); handler.post(scan); }
    @Override protected void onPause() { handler.removeCallbacks(scan); super.onPause(); }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(scan);
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else finish();
    }
}
