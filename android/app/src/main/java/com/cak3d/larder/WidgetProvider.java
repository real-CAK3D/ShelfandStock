package com.cak3d.larder;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

// Home-screen widget: the shopping list, what's about to go bad, and the next store run.
public class WidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c));
    }

    static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        try {
            JSONObject w = new JSONObject(NoticeWorker.prefs(c).getString("widget", "{}"));
            JSONArray list = w.optJSONArray("list"), exp = w.optJSONArray("exp");
            StringBuilder sb = new StringBuilder();
            if (list != null) for (int i = 0; i < list.length(); i++) sb.append(i > 0 ? "\n" : "").append(list.getString(i));
            int more = w.optInt("more");
            if (more > 0) sb.append("\n+ ").append(more).append(" more");
            v.setTextViewText(R.id.widget_list, sb.length() > 0 ? sb.toString() : "Nothing on the list 🎉");
            StringBuilder eb = new StringBuilder();
            if (exp != null) for (int i = 0; i < exp.length(); i++) eb.append(i > 0 ? "\n" : "").append(exp.getString(i));
            v.setTextViewText(R.id.widget_exp, eb.toString());
            v.setViewVisibility(R.id.widget_exp_title, eb.length() > 0 ? View.VISIBLE : View.GONE);
            v.setViewVisibility(R.id.widget_exp, eb.length() > 0 ? View.VISIBLE : View.GONE);
            String trip = w.optString("trip");
            v.setTextViewText(R.id.widget_trip, trip);
            v.setViewVisibility(R.id.widget_trip, trip.isEmpty() ? View.GONE : View.VISIBLE);
        } catch (Exception ignored) { }
        PendingIntent pi = PendingIntent.getActivity(c, 1, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
        for (int id : ids) m.updateAppWidget(id, views(c));
    }
}
