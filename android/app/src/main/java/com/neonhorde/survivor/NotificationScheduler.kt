package com.neonhorde.survivor

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit

/**
 * Local reminders ("Free Gold Crate is ready", "Patrol storage is full", "Energy recharged").
 * Uses inexact alarms (no SCHEDULE_EXACT_ALARM permission needed) and survives reboots via [BootReceiver].
 */
object NotificationScheduler {

    const val CHANNEL_ID = "rewards"
    private const val PREFS = "nh_notifications"
    const val EXTRA_ID = "id"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply { description = context.getString(R.string.notif_channel_desc) }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun schedule(context: Context, id: Int, delaySec: Long, title: String, body: String) {
        if (delaySec <= 0) return
        val triggerAt = System.currentTimeMillis() + delaySec * 1000L
        prefs(context).edit {
            putLong("at_$id", triggerAt)
            putString("title_$id", title)
            putString("body_$id", body)
        }
        setAlarm(context, id, triggerAt, title, body)
    }

    fun cancel(context: Context, id: Int) {
        context.getSystemService(AlarmManager::class.java).cancel(pendingIntent(context, id, "", ""))
        forget(context, id)
    }

    fun forget(context: Context, id: Int) {
        prefs(context).edit {
            remove("at_$id")
            remove("title_$id")
            remove("body_$id")
        }
    }

    /** Re-arms every stored reminder (alarms are cleared when the device reboots). */
    fun rescheduleAll(context: Context) {
        val p = prefs(context)
        val now = System.currentTimeMillis()
        for (key in p.all.keys.filter { it.startsWith("at_") }) {
            val id = key.removePrefix("at_").toIntOrNull() ?: continue
            val at = p.getLong(key, 0L)
            val title = p.getString("title_$id", null) ?: continue
            val body = p.getString("body_$id", null) ?: continue
            if (at > now) setAlarm(context, id, at, title, body) else forget(context, id)
        }
    }

    fun show(context: Context, id: Int, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val open = PendingIntent.getActivity(
            context,
            id,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(ContextCompat.getColor(context, R.color.nh_cyan))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        NotificationManagerCompat.from(context).notify(id, notification)
    }

    private fun setAlarm(context: Context, id: Int, triggerAt: Long, title: String, body: String) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent(context, id, title, body))
    }

    private fun pendingIntent(context: Context, id: Int, title: String, body: String): PendingIntent {
        val intent = Intent(context, NotificationReceiver::class.java)
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
