package com.cak3d.larder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

// Runs in the background (JobScheduler, ~every 15 minutes) while the app is closed:
// shows household notices as notifications, reminds before a store run's list closes,
// and refreshes the home-screen widget from the shared kitchen.
final class NoticeWorker {
    static final String PREFS = "shelfstock";
    static final String CHANNEL = "household";
    private static final int JOB_ID = 4242;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void schedule(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (prefs(c).getString("code", "").isEmpty()) { js.cancel(JOB_ID); return; }
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(c, NoticeJobService.class))
                .setPeriodic(15 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build();
        js.schedule(job);
    }

    static String post(SharedPreferences p, String fn, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(p.getString("url", "") + "/rest/v1/rpc/" + fn).openConnection();
        c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(10000); c.setReadTimeout(15000);
        c.setRequestProperty("apikey", p.getString("key", ""));
        c.setRequestProperty("Content-Type", "application/json");
        try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
        if (c.getResponseCode() >= 400) throw new Exception("HTTP " + c.getResponseCode());
        InputStream in = c.getInputStream();
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384]; int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        c.disconnect();
        return bo.toString("UTF-8");
    }

    static void run(Context ctx) throws Exception {
        SharedPreferences p = prefs(ctx);
        String code = p.getString("code", "");
        if (code.isEmpty()) return;
        String me = p.getString("me", "");
        JSONObject kinds = new JSONObject(p.getString("kinds", "{}"));
        long lastId = p.getLong("lastId", -1);
        JSONArray trips = new JSONArray(p.getString("trips", "[]"));

        // 1) new notices
        JSONArray rows = new JSONArray(post(p, "shelfstock_notices", new JSONObject().put("p_code", code).put("p_after", Math.max(0, lastId)).toString()));
        long maxId = lastId;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject r = rows.getJSONObject(i);
            maxId = Math.max(maxId, r.getLong("id"));
            if (lastId < 0) continue; // first run: catch up quietly
            String kind = r.optString("kind");
            JSONObject data = r.optJSONObject("data");
            if ("trip".equals(kind) && data != null && !data.optString("cutoff").isEmpty())
                trips.put(new JSONObject().put("id", r.getLong("id")).put("cutoff", data.optString("cutoff")).put("store", data.optString("store", "the store")).put("by", data.optString("by")));
            if (me.equals(r.optString("by_member")) || !kinds.optBoolean(kind, true)) continue;
            notify(ctx, (int) (r.getLong("id") % 100000), "Shelf & Stock", r.optString("text"));
        }

        // 2) "the list closes soon" reminders
        long now = System.currentTimeMillis();
        JSONArray keep = new JSONArray();
        SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
        isoFmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        for (int i = 0; i < trips.length(); i++) {
            JSONObject t = trips.getJSONObject(i);
            Date cut = isoFmt.parse(t.getString("cutoff").substring(0, 19));
            long ms = cut.getTime() - now;
            if (ms < 0) continue;
            if (ms <= 70 * 60 * 1000L && !t.optBoolean("reminded") && !me.equals(t.optString("by")) && kinds.optBoolean("trip", true)) {
                String when = new SimpleDateFormat("h:mm a", Locale.US).format(cut);
                notify(ctx, 90000 + (int) (t.getLong("id") % 9000), "List closes soon", "The list for " + t.getString("store") + " closes at " + when + " — add anything you need.");
                t.put("reminded", true);
            }
            keep.put(t);
        }
        p.edit().putLong("lastId", maxId).putString("trips", keep.toString()).apply();

        // 3) fresh widget from the shared kitchen
        try {
            JSONArray pull = new JSONArray(post(p, "shelfstock_pull", new JSONObject().put("p_code", code).toString()));
            if (pull.length() > 0) p.edit().putString("widget", widgetFrom(pull.getJSONObject(0).getJSONObject("state"))).apply();
            WidgetProvider.refresh(ctx);
        } catch (Exception ignored) { }
    }

    // Same summary the app sends when it's open: list, what's going bad, next store run.
    static String widgetFrom(JSONObject st) throws Exception {
        JSONArray shop = st.optJSONArray("shopping"), items = st.optJSONArray("items");
        JSONArray list = new JSONArray(), exp = new JSONArray();
        int open = 0;
        if (shop != null) for (int i = 0; i < shop.length(); i++) {
            JSONObject e = shop.getJSONObject(i);
            if (e.optBoolean("done")) continue;
            if (open++ < 7) list.put(e.optString("emoji") + " " + e.optString("name"));
        }
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String soon = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(System.currentTimeMillis() + 3 * 86400000L));
        if (items != null) for (int i = 0; i < items.length() && exp.length() < 4; i++) {
            JSONObject it = items.getJSONObject(i);
            String d = it.optString("expires", "");
            if (!d.isEmpty() && !"null".equals(d) && d.compareTo(soon) <= 0) exp.put(it.optString("emoji") + " " + it.optString("name") + (d.compareTo(today) < 0 ? " · expired" : " · use soon"));
        }
        return new JSONObject().put("list", list).put("more", Math.max(0, open - list.length())).put("exp", exp).put("trip", "").toString();
    }

    static void notify(Context c, int id, String title, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Household", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent pi = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text)).setAutoCancel(true).setContentIntent(pi);
        try { nm.notify(id, b.build()); } catch (SecurityException ignored) { }
    }
}
