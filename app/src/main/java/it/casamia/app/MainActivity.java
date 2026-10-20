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
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.FrameLayout;
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
    private static final int BACKUP_LINK = 4202;

    private WebView web;
    private boolean isResumed = false;
    // Contenuto condiviso verso l'app (file di progetto o link) in attesa che la pagina sia pronta
    private String pendingShared = null;
    private boolean pageReady = false;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private ShopPanel shopPanel;
    private WebView printView;

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
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        shopPanel = new ShopPanel(this, root, web);
        Notifier.ensureChannels(this);
        try {
            PriceWorker.schedule(this);
        } catch (Exception e) {
            Log.w(TAG, "Controllo prezzi non programmato", e);
        }

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
                cameraUri = null;
                try {
                    Intent intent;
                    if (params.isCaptureEnabled()) {
                        // foto diretta dalla fotocamera
                        File dir = new File(getCacheDir(), "foto");
                        dir.mkdirs();
                        File out = new File(dir, "foto-" + System.currentTimeMillis() + ".jpg");
                        cameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".file", out);
                        intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } else {
                        intent = new Intent(Intent.ACTION_GET_CONTENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("*/*");
                        java.util.ArrayList<String> types = new java.util.ArrayList<>();
                        for (String a : params.getAcceptTypes()) {
                            for (String t : a.split(",")) {
                                t = t.trim();
                                if (t.isEmpty()) continue;
                                if (t.startsWith(".")) t = "json".equals(t.substring(1)) ? "application/json" : "*/*";
                                types.add(t);
                            }
                        }
                        if (!types.isEmpty() && !types.contains("*/*")) intent.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
                    }
                    startActivityForResult(intent, FILE_CHOOSER);
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
        handleShared(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShared(intent);
    }

    /** Apri con / Condividi: legge il file o il testo ricevuto e lo passa alla pagina. */
    private void handleShared(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        String text = null;
        if (Intent.ACTION_VIEW.equals(action)) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(action)) {
            Object st = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (st instanceof Uri) uri = (Uri) st;
            else text = intent.getStringExtra(Intent.EXTRA_TEXT);
        } else return;
        intent.setAction(Intent.ACTION_MAIN); // non rielaborarlo a ogni rotazione
        final Uri fUri = uri;
        final String fText = text;
        new Thread(() -> {
            String out = fText;
            if (fUri != null) {
                try (java.io.InputStream in = getContentResolver().openInputStream(fUri)) {
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                    byte[] buf = new byte[65536];
                    int n, tot = 0;
                    while (in != null && (n = in.read(buf)) > 0) { bo.write(buf, 0, n); tot += n; if (tot > 60 * 1024 * 1024) break; }
                    String mime = getContentResolver().getType(fUri);
                    if (mime != null && mime.startsWith("image/")) out = "data:" + mime + ";base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                    else out = new String(bo.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
                } catch (Exception e) {
                    Log.w(TAG, "Lettura file condiviso non riuscita", e);
                    out = "";
                }
            }
            final String res = out == null ? "" : out;
            runOnUiThread(() -> {
                if (pageReady) web.evaluateJavascript("window.CasaMia && CasaMia.onShared && CasaMia.onShared(" + org.json.JSONObject.quote(res) + ")", null);
                else pendingShared = res;
            });
        }).start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        isResumed = true;
        if (web != null) { web.onResume(); web.evaluateJavascript("window.CasaMia && CasaMia.app && CasaMia.app.resumed && CasaMia.app.resumed()", null); }
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
        if (requestCode == BACKUP_LINK) {
            boolean ok = false;
            String name = "";
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri u = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception e) { Log.w(TAG, "Permesso persistente non concesso", e); }
                getSharedPreferences("casamia", MODE_PRIVATE).edit().putString("backupUri", u.toString()).apply();
                ok = true;
                name = u.getAuthority() != null && u.getAuthority().contains("google") ? "Google Drive" : "la cartella scelta";
            }
            web.evaluateJavascript("window.CasaMia && CasaMia.onBackupLinked && CasaMia.onBackupLinked(" + ok + "," + org.json.JSONObject.quote(name) + ")", null);
            return;
        }
        if (requestCode == FILE_CHOOSER) {
            if (fileCallback != null) {
                Uri[] res;
                if (cameraUri != null) res = resultCode == RESULT_OK ? new Uri[]{cameraUri} : null;
                else if (resultCode == RESULT_OK && data != null && data.getData() != null) res = new Uri[]{data.getData()};
                else res = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileCallback.onReceiveValue(res);
                fileCallback = null;
            }
            cameraUri = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (shopPanel != null && shopPanel.back()) return;
        // Lascia decidere all'app web (chiudere un pannello, tornare alla home...)
        web.evaluateJavascript("(window.CasaMia && CasaMia.onBack) ? CasaMia.onBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.CasaMia && CasaMia.flush && CasaMia.flush()", null);
        // In background l'app si ferma del tutto: niente timer né disegno
        isResumed = false;
        web.postDelayed(() -> { if (!isResumed && web != null) web.onPause(); }, 400);
    }

    /** Archivio chiave/valore su file nella memoria privata dell'app. */
    private class Bridge {
        /** Sceglie (una volta) il file di backup su Drive o altrove: poi viene riscritto a ogni salvataggio. */
        @JavascriptInterface
        public void linkBackup() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, "CasaMia-backup.casamia.json");
                i.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(i, BACKUP_LINK); } catch (Exception e) { Log.e(TAG, "Selettore non disponibile", e); }
            });
        }

        @JavascriptInterface
        public boolean hasBackupLink() {
            return getSharedPreferences("casamia", MODE_PRIVATE).getString("backupUri", null) != null;
        }

        @JavascriptInterface
        public void unlinkBackup() {
            getSharedPreferences("casamia", MODE_PRIVATE).edit().remove("backupUri").apply();
        }

        /** Riscrive il file di backup collegato (in un thread: Drive pu\u00f2 essere lento). */
        @JavascriptInterface
        public void writeBackup(final String base64) {
            final String us = getSharedPreferences("casamia", MODE_PRIVATE).getString("backupUri", null);
            if (us == null) return;
            new Thread(() -> {
                boolean ok;
                try (OutputStream os = getContentResolver().openOutputStream(Uri.parse(us), "wt")) {
                    if (os == null) throw new IOException("nessun flusso");
                    os.write(Base64.decode(base64, Base64.DEFAULT));
                    ok = true;
                } catch (Exception e) {
                    Log.w(TAG, "Backup su Drive non scritto", e);
                    ok = false;
                }
                final boolean r = ok;
                runOnUiThread(() -> web.evaluateJavascript("window.CasaMia && CasaMia.onBackupWritten && CasaMia.onBackupWritten(" + r + ")", null));
            }).start();
        }

        @JavascriptInterface
        public String takeShared() {
            final String[] out = { null };
            final java.util.concurrent.CountDownLatch l = new java.util.concurrent.CountDownLatch(1);
            runOnUiThread(() -> { pageReady = true; out[0] = pendingShared; pendingShared = null; l.countDown(); });
            try { l.await(2, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
            return out[0] == null ? "" : out[0];
        }

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
        public void shareFile(String name, String mime, String base64) {
            try {
                File dir = new File(getCacheDir(), "condivisi");
                dir.mkdirs();
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 86400000L) f.delete();
                File out = new File(dir, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
                try (OutputStream os = new FileOutputStream(out)) {
                    os.write(Base64.decode(base64, Base64.DEFAULT));
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".file", out);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, name);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Condividi " + name);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(chooser));
            } catch (Exception e) {
                Log.e(TAG, "Condivisione non riuscita", e);
                toast("Condivisione non riuscita");
            }
        }

        @JavascriptInterface
        public void printHtml(String html, String title) { printHtmlMedia(html, title, "A4"); }

        /** Stampa/PDF con il formato carta scelto: A4, A4L (orizzontale), A3, A3L, A2L, A1L. */
        @JavascriptInterface
        public void printHtmlMedia(String html, String title, String media) {
            final PrintAttributes.MediaSize size;
            switch (media == null ? "A4" : media) {
                case "A4L": size = PrintAttributes.MediaSize.ISO_A4.asLandscape(); break;
                case "A3": size = PrintAttributes.MediaSize.ISO_A3; break;
                case "A3L": size = PrintAttributes.MediaSize.ISO_A3.asLandscape(); break;
                case "A2L": size = PrintAttributes.MediaSize.ISO_A2.asLandscape(); break;
                case "A1L": size = PrintAttributes.MediaSize.ISO_A1.asLandscape(); break;
                default: size = PrintAttributes.MediaSize.ISO_A4;
            }
            runOnUiThread(() -> {
                printView = new WebView(MainActivity.this);
                printView.getSettings().setJavaScriptEnabled(false);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        String job = (title == null || title.isEmpty() ? "Casa Mia" : title);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(job);
                        pm.print(job, adapter, new PrintAttributes.Builder().setMediaSize(size).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build());
                    }
                });
                printView.loadDataWithBaseURL("https://appassets.androidplatform.net/", html, "text/html", "utf-8", null);
            });
        }

        @JavascriptInterface
        public String pdfToImage(String base64) {
            File tmp = new File(getCacheDir(), "planimetria.pdf");
            try {
                try (OutputStream os = new FileOutputStream(tmp)) {
                    os.write(Base64.decode(base64, Base64.DEFAULT));
                }
                try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(tmp, ParcelFileDescriptor.MODE_READ_ONLY);
                     PdfRenderer r = new PdfRenderer(fd)) {
                    if (r.getPageCount() < 1) return null;
                    try (PdfRenderer.Page page = r.openPage(0)) {
                        float k = 2200f / Math.max(page.getWidth(), page.getHeight());
                        int w = Math.max(1, Math.round(page.getWidth() * k)), h = Math.max(1, Math.round(page.getHeight() * k));
                        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                        bmp.eraseColor(Color.WHITE);
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                        bmp.compress(Bitmap.CompressFormat.PNG, 100, bos);
                        bmp.recycle();
                        return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "PDF non leggibile", e);
                return null;
            } finally {
                tmp.delete();
            }
        }

        @JavascriptInterface
        public boolean saveDocument(String name, String mime, String base64) {
            if (Build.VERSION.SDK_INT >= 29) {
                try {
                    android.content.ContentResolver cr = getContentResolver();
                    Uri coll = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    String rel = Environment.DIRECTORY_DOWNLOADS + "/CasaMia/";
                    // sostituisce la copia precedente salvata dall'app
                    cr.delete(coll, MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?", new String[]{name, rel});
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
                    Uri uri = cr.insert(coll, cv);
                    if (uri == null) return false;
                    try (OutputStream os = cr.openOutputStream(uri)) {
                        if (os == null) return false;
                        os.write(Base64.decode(base64, Base64.DEFAULT));
                    }
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Backup automatico non salvato", e);
                    return false;
                }
            }
            return false;
        }

        /** Scarica un file binario (modello 3D GLB del negozio) e lo restituisce come data URL base64. */
        @JavascriptInterface
        public void fetchBinary(String url, String cbId) {
            new Thread(() -> {
                String result = "";
                try {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36");
                    c.setConnectTimeout(15000); c.setReadTimeout(40000);
                    try (InputStream in = c.getInputStream()) {
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        byte[] buf = new byte[65536]; int n, tot = 0;
                        while ((n = in.read(buf)) > 0) { bo.write(buf, 0, n); tot += n; if (tot > 30 * 1024 * 1024) throw new IOException("troppo grande"); }
                        result = "data:model/gltf-binary;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                    }
                } catch (Exception e) { Log.w(TAG, "Modello 3D non scaricato", e); }
                final String js = "window.CasaMia && CasaMia.onBinaryFetched && CasaMia.onBinaryFetched(" + org.json.JSONObject.quote(cbId) + "," + org.json.JSONObject.quote(result) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        /** Scarica un'immagine (foto prodotto) e la restituisce come data URL, aggirando i limiti dei siti. */
        @JavascriptInterface
        public void fetchImage(String url, String cbId, int maxSize) {
            new Thread(() -> {
                String result = "";
                java.net.HttpURLConnection con = null;
                try {
                    con = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    con.setConnectTimeout(15000);
                    con.setReadTimeout(20000);
                    con.setInstanceFollowRedirects(true);
                    con.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36");
                    con.setRequestProperty("Accept", "image/avif,image/webp,image/*,*/*");
                    InputStream in = con.getInputStream();
                    java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n, total = 0;
                    while ((n = in.read(buf)) > 0 && total < 12_000_000) { bos.write(buf, 0, n); total += n; }
                    in.close();
                    byte[] data = bos.toByteArray();
                    android.graphics.BitmapFactory.Options o = new android.graphics.BitmapFactory.Options();
                    o.inJustDecodeBounds = true;
                    android.graphics.BitmapFactory.decodeByteArray(data, 0, data.length, o);
                    int sample = 1, lim = maxSize > 0 ? maxSize : 1024;
                    while (o.outWidth / (sample * 2) >= lim || o.outHeight / (sample * 2) >= lim) sample *= 2;
                    o = new android.graphics.BitmapFactory.Options();
                    o.inSampleSize = sample;
                    Bitmap bmp = android.graphics.BitmapFactory.decodeByteArray(data, 0, data.length, o);
                    if (bmp != null) {
                        float k = Math.min(1f, (float) lim / Math.max(bmp.getWidth(), bmp.getHeight()));
                        if (k < 1f) {
                            Bitmap sc = Bitmap.createScaledBitmap(bmp, Math.max(1, Math.round(bmp.getWidth() * k)), Math.max(1, Math.round(bmp.getHeight() * k)), true);
                            bmp.recycle();
                            bmp = sc;
                        }
                        Bitmap flat = Bitmap.createBitmap(bmp.getWidth(), bmp.getHeight(), Bitmap.Config.ARGB_8888);
                        flat.eraseColor(Color.WHITE);
                        new android.graphics.Canvas(flat).drawBitmap(bmp, 0, 0, null);
                        bmp.recycle();
                        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                        flat.compress(Bitmap.CompressFormat.JPEG, 85, out);
                        flat.recycle();
                        result = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Immagine non scaricata: " + url);
                } finally {
                    if (con != null) con.disconnect();
                }
                final String js = "window.CasaMia && CasaMia.onImageFetched && CasaMia.onImageFetched(" + org.json.JSONObject.quote(cbId) + "," + org.json.JSONObject.quote(result) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            }).start();
        }

        @JavascriptInterface
        public void openShop(String url) {
            runOnUiThread(() -> shopPanel.open(url));
        }

        @JavascriptInterface
        public void refreshPrices(String json) {
            runOnUiThread(() -> shopPanel.refreshPrices(json));
        }

        @JavascriptInterface
        public void setPriceWatch(String json) {
            try {
                org.json.JSONArray incoming = new org.json.JSONArray(json);
                android.content.SharedPreferences p = getSharedPreferences(PriceWorker.PREFS, MODE_PRIVATE);
                org.json.JSONArray old = new org.json.JSONArray(p.getString("lista", "[]"));
                java.util.HashMap<String, Double> last = new java.util.HashMap<>();
                for (int i = 0; i < old.length(); i++) {
                    org.json.JSONObject o = old.getJSONObject(i);
                    if (o.has("ultimo")) last.put(o.getString("id"), o.getDouble("ultimo"));
                }
                for (int i = 0; i < incoming.length(); i++) {
                    org.json.JSONObject o = incoming.getJSONObject(i);
                    Double l = last.get(o.optString("id"));
                    if (l != null) o.put("ultimo", Math.min(l, o.optDouble("price", l)));
                }
                p.edit().putString("lista", incoming.toString()).apply();
                PriceWorker.schedule(MainActivity.this);
            } catch (Exception e) {
                Log.w(TAG, "Lista prezzi non salvata", e);
            }
        }

        @JavascriptInterface
        public void scheduleReminder(String id, double when, String title, String text) {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 77));
            }
            Reminders.schedule(MainActivity.this, id, (long) when, title, text);
        }

        @JavascriptInterface
        public void cancelReminder(String id) {
            Reminders.cancel(MainActivity.this, id);
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
