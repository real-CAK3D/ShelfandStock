package com.cak3d.larder;

import android.app.job.JobParameters;
import android.app.job.JobService;

// Background check for household notices (see NoticeWorker).
public class NoticeJobService extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try { NoticeWorker.run(this); } catch (Exception ignored) { }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }
}
