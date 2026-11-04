package com.cak3d.larder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

// While someone is out shopping: checks for new notices every 20 seconds, even with the phone in a pocket,
// so a thing added from home chimes and buzzes right away instead of at the next 15-minute background check.
public class ShoppingService extends Service {
    static final String CHANNEL_STATUS = "shopping-status";
    private static final int ID = 7711;
    private static final long EVERY_MS = 20000, MAX_MS = 5 * 3600 * 1000L; // Android limits how long this kind of service runs
    private volatile boolean running;
    private Thread loop;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL_STATUS, "Shopping (listening for list changes)", NotificationManager.IMPORTANCE_LOW));
        PendingIntent pi = PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_STATUS) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat).setContentTitle("You're shopping").setContentText("We'll buzz if someone adds to the list. Tap Done shopping in the app to stop.").setOngoing(true).setContentIntent(pi);
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, b.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID, b.build());
        if (loop == null) {
            running = true;
            final long end = System.currentTimeMillis() + MAX_MS;
            loop = new Thread(() -> {
                while (running && System.currentTimeMillis() < end) {
                    try { NoticeWorker.checkNotices(this); } catch (Exception ignored) { }
                    try { Thread.sleep(EVERY_MS); } catch (InterruptedException e) { return; }
                }
                stopSelf();
            });
            loop.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (loop != null) loop.interrupt();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
