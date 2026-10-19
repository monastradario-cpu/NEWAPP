package it.casamia.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONObject;


/** Promemoria programmati con AlarmManager, salvati per ripristinarli dopo il riavvio. */
public final class Reminders {
    private static final String PREFS = "promemoria";

    private Reminders() {
    }

    private static PendingIntent pending(Context ctx, String id, String title, String text) {
        Intent i = new Intent(ctx, Receiver.class);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("text", text);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    public static void schedule(Context ctx, String id, long when, String title, String text) {
        try {
            JSONObject o = new JSONObject();
            o.put("when", when);
            o.put("title", title);
            o.put("text", text);
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(id, o.toString()).apply();
        } catch (Exception ignored) {
        }
        arm(ctx, id, when, title, text);
    }

    private static void arm(Context ctx, String id, long when, String title, String text) {
        if (when < System.currentTimeMillis()) return;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending(ctx, id, title, text));
    }

    public static void cancel(Context ctx, String id) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(ctx, id, "", ""));
    }

    public static void rearmAll(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        for (String id : p.getAll().keySet()) {
            try {
                JSONObject o = new JSONObject(p.getString(id, "{}"));
                arm(ctx, id, o.getLong("when"), o.optString("title"), o.optString("text"));
            } catch (Exception ignored) {
            }
        }
    }

    /** Mostra la notifica del promemoria. */
    public static class Receiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String id = intent.getStringExtra("id");
            String title = intent.getStringExtra("title");
            String text = intent.getStringExtra("text");
            Notifier.show(ctx, Notifier.CH_REMINDERS, id == null ? 1 : id.hashCode(), title == null ? "Casa Mia" : title, text == null ? "Promemoria" : text);
            if (id != null) ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply();
        }
    }

    /** Ripristina promemoria e controllo prezzi dopo il riavvio del telefono. */
    public static class Boot extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
                rearmAll(ctx);
                PriceWorker.schedule(ctx);
            }
        }
    }
}
