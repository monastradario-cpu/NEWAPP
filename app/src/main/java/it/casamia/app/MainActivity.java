package it.casamia.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;

/**
 * Guscio nativo di Casa Mia: ospita l'app web (assets/www) in una WebView
 * servita da un'origine https locale e offre un ponte per salvare i dati
 * in modo persistente nella memoria interna dell'app.
 */
public class MainActivity extends Activity {

    private static final String TAG = "CasaMia";
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int FILE_CHOOSER = 4201;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    // Aggiornamento dell'app
    private long updateDownloadId = -1;
    private File updateApk;
    private boolean awaitingInstallPermission = false;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id == -1 || id != updateDownloadId) return;
            updateDownloadId = -1;
            boolean ok = false;
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
                if (c != null && c.moveToFirst()) {
                    ok = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL;
                }
            } catch (Exception e) {
                Log.e(TAG, "Stato download non leggibile", e);
            }
            if (ok && updateApk != null && updateApk.exists()) {
                notifyUpdate("scaricato");
                installUpdate();
            } else {
                notifyUpdate("errore");
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        web = new WebView(this);
        web.setBackgroundColor(0xFFF6F5F1);
        setContentView(web);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("appassets.androidplatform.net".equals(url.getHost())) return false;
                // Link esterni: aprili nel browser del telefono
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception e) {
                    Log.w(TAG, "Impossibile aprire " + url, e);
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, m.message() + " [" + m.sourceId() + ":" + m.lineNumber() + "]");
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        web.addJavascriptInterface(new Bridge(), "CasaMiaAndroid");

        try {
            android.content.pm.PackageInfo wv = WebView.getCurrentWebViewPackage();
            Log.i(TAG, "WebView: " + (wv != null ? wv.packageName + " " + wv.versionName : "sconosciuta"));
        } catch (Exception e) {
            Log.w(TAG, "WebView: versione non disponibile");
        }

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, filter);
        }

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Rientro dalle impostazioni dopo aver concesso il permesso di installare
        if (awaitingInstallPermission && getPackageManager().canRequestPackageInstalls()) {
            awaitingInstallPermission = false;
            installUpdate();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    private void notifyUpdate(String status) {
        runOnUiThread(() -> web.evaluateJavascript(
                "window.CasaMia && CasaMia.onUpdateStatus && CasaMia.onUpdateStatus('" + status + "')", null));
    }

    private void startUpdateDownload(String url, String version) {
        try {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null) {
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) if (f.getName().endsWith(".apk")) f.delete();
            }
            String name = "CasaMia-" + version.replaceAll("[^0-9.]", "") + ".apk";
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("Casa Mia " + version)
                    .setDescription("Aggiornamento dell'app")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
            updateApk = new File(dir, name);
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            updateDownloadId = dm.enqueue(req);
            notifyUpdate("download");
        } catch (Exception e) {
            Log.e(TAG, "Download aggiornamento non avviato", e);
            notifyUpdate("errore");
        }
    }

    private void installUpdate() {
        if (updateApk == null || !updateApk.exists()) {
            notifyUpdate("errore");
            return;
        }
        if (!getPackageManager().canRequestPackageInstalls()) {
            awaitingInstallPermission = true;
            notifyUpdate("permesso");
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
            } catch (Exception e) {
                Log.e(TAG, "Impostazioni permesso non disponibili", e);
            }
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".file", updateApk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Log.e(TAG, "Installazione non avviata", e);
            notifyUpdate("errore");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Lascia decidere all'app web (chiudere un pannello, tornare alla home...)
        web.evaluateJavascript("(window.CasaMia && CasaMia.onBack) ? CasaMia.onBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.CasaMia && CasaMia.flush && CasaMia.flush()", null);
    }

    /** Archivio chiave/valore su file nella memoria privata dell'app. */
    private class Bridge {
        private File dir() {
            File d = new File(getFilesDir(), "dati");
            if (!d.exists()) d.mkdirs();
            return d;
        }

        private File fileFor(String key) {
            String safe = key == null ? "" : key.replaceAll("[^A-Za-z0-9_\\-]", "_");
            if (safe.isEmpty()) safe = "_";
            return new File(dir(), safe + ".json");
        }

        @JavascriptInterface
        public boolean put(String key, String value) {
            File target = fileFor(key);
            File tmp = new File(target.getPath() + ".tmp");
            try (OutputStream out = new FileOutputStream(tmp)) {
                out.write(value.getBytes(StandardCharsets.UTF_8));
                out.flush();
            } catch (IOException e) {
                Log.e(TAG, "Salvataggio fallito: " + key, e);
                return false;
            }
            if (target.exists() && !target.delete()) return false;
            return tmp.renameTo(target);
        }

        @JavascriptInterface
        public String get(String key) {
            File f = fileFor(key);
            if (!f.exists()) return null;
            try (InputStream in = new FileInputStream(f)) {
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                return new String(bos.toByteArray(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                Log.e(TAG, "Lettura fallita: " + key, e);
                return null;
            }
        }

        @JavascriptInterface
        public boolean remove(String key) {
            File f = fileFor(key);
            return !f.exists() || f.delete();
        }

        @JavascriptInterface
        public String keys() {
            JSONArray arr = new JSONArray();
            File[] files = dir().listFiles();
            if (files != null) {
                for (File f : files) {
                    String n = f.getName();
                    if (n.endsWith(".json")) arr.put(n.substring(0, n.length() - 5));
                }
            }
            return arr.toString();
        }

        @JavascriptInterface
        public void toast(String text) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void update(String url, String version) {
            if (url == null || !url.startsWith("https://github.com/monastradario-cpu/")) {
                notifyUpdate("errore");
                return;
            }
            runOnUiThread(() -> startUpdateDownload(url, version));
        }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "?";
            }
        }
    }
}
