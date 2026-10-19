package it.casamia.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Controlla periodicamente i prezzi degli articoli importati e avvisa se scendono.
 * Funziona con i negozi che inseriscono il prezzo nel codice della pagina.
 */
public class PriceWorker extends Worker {
    static final String PREFS = "prezzi";
    private static final String TAG = "CasaMiaPrezzi";
    private static final Pattern LD = Pattern.compile("<script[^>]*application/ld\\+json[^>]*>(.*?)</script>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern PRICE_JSON = Pattern.compile("\"(?:price|lowPrice)\"\\s*:\\s*\"?([0-9]+(?:[.,][0-9]+)?)");
    private static final Pattern PRICE_META = Pattern.compile("(?:product:price:amount|itemprop=\"price\")[^>]*content=\"([0-9]+(?:[.,][0-9]+)?)\"", Pattern.CASE_INSENSITIVE);

    public PriceWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    public static void schedule(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String list = p.getString("lista", "[]");
        WorkManager wm = WorkManager.getInstance(ctx);
        if ("[]".equals(list)) {
            wm.cancelUniqueWork("prezzi");
            return;
        }
        Constraints c = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(PriceWorker.class, 12, TimeUnit.HOURS).setConstraints(c).build();
        wm.enqueueUniquePeriodicWork("prezzi", ExistingPeriodicWorkPolicy.KEEP, req);
    }

    static Double fetchPrice(String url) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(15000);
            con.setReadTimeout(20000);
            con.setInstanceFollowRedirects(true);
            con.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36");
            con.setRequestProperty("Accept-Language", "it-IT,it;q=0.9");
            if (con.getResponseCode() >= 400) return null;
            InputStream in = con.getInputStream();
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n, total = 0;
            while ((n = in.read(buf)) > 0 && total < 3_000_000) {
                bos.write(buf, 0, n);
                total += n;
            }
            in.close();
            String html = new String(bos.toByteArray(), StandardCharsets.UTF_8);
            Matcher ld = LD.matcher(html);
            while (ld.find()) {
                String block = ld.group(1);
                if (!block.contains("Product") && !block.contains("Offer")) continue;
                Matcher pm = PRICE_JSON.matcher(block);
                if (pm.find()) return Double.parseDouble(pm.group(1).replace(',', '.'));
            }
            Matcher mm = PRICE_META.matcher(html);
            if (mm.find()) return Double.parseDouble(mm.group(1).replace(',', '.'));
        } catch (Exception e) {
            Log.w(TAG, "Prezzo non letto: " + url);
        } finally {
            if (con != null) con.disconnect();
        }
        return null;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray list = new JSONArray(p.getString("lista", "[]"));
            boolean changed = false;
            for (int i = 0; i < list.length(); i++) {
                JSONObject it = list.getJSONObject(i);
                Double now = fetchPrice(it.getString("url"));
                if (now == null || now <= 0) continue;
                double last = it.optDouble("ultimo", it.optDouble("price", 0));
                if (it.optBoolean("material") && it.has("canL")) now = now / it.getDouble("canL");
                if (last > 0 && now < last * 0.99) {
                    Notifier.show(ctx, Notifier.CH_PRICES, it.getString("id").hashCode(), "Prezzo sceso: " + it.optString("name"),
                            String.format(java.util.Locale.ITALY, "Da %.2f € a %.2f €. Apri Casa Mia e ricontrolla i prezzi.", last, now));
                }
                if (Math.abs(now - last) > 0.009) {
                    it.put("ultimo", now);
                    changed = true;
                }
            }
            if (changed) p.edit().putString("lista", list.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Controllo prezzi non riuscito", e);
            return Result.retry();
        }
        return Result.success();
    }
}
