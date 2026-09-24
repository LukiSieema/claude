package com.neonhorde.survivor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fires a scheduled reminder. */
class NotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(NotificationScheduler.EXTRA_ID, 0)
        val title = intent.getStringExtra(NotificationScheduler.EXTRA_TITLE).orEmpty()
        val body = intent.getStringExtra(NotificationScheduler.EXTRA_BODY).orEmpty()
        NotificationScheduler.forget(context, id)
        if (title.isEmpty() || NeonHordeApp.isInForeground) return
        NotificationScheduler.show(context, id, title, body)
    }
}
