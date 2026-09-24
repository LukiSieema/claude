package com.neonhorde.survivor

import android.app.Application

class NeonHordeApp : Application() {

    override fun onCreate() {
        super.onCreate()
        NotificationScheduler.createChannel(this)
    }

    companion object {
        /** True while the game activity is resumed; reminders are not shown on top of the running game. */
        @Volatile
        var isInForeground: Boolean = false
    }
}
