package it.casamia.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Browser interno per i negozi, con importazione degli articoli della pagina aperta. */
public class ShopPanel {
    private final Activity act;
    private final FrameLayout root;
    private final WebView main;
    private LinearLayout panel;
    private WebView shop;
    private TextView title;
    private ProgressBar progress;
    private String extractor;

    ShopPanel(Activity act, FrameLayout root, WebView main) {
        this.act = act;
        this.root = root;
        this.main = main;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, act.getResources().getDisplayMetrics());
    }

    String extractor() {
        if (extractor != null) return extractor;
        try (InputStream in = act.getAssets().open("www/js/extract.js")) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            extractor = new String(bos.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            extractor = "JSON.stringify({items:[]})";
        }
        return extractor;
    }

    boolean isOpen() {
        return panel != null && panel.getVisibility() == View.VISIBLE;
    }

    /** Indietro: torna alla pagina precedente o chiude il negozio. */
    boolean back() {
        if (!isOpen()) return false;
        if (shop.canGoBack()) shop.goBack();
        else close();
        return true;
    }

    void close() {
        if (panel == null) return;
        panel.setVisibility(View.GONE);
        shop.loadUrl("about:blank");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void build() {
        panel = new LinearLayout(act);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackgroundColor(0xFFF6F5F1);
        panel.setClickable(true);

        LinearLayout top = new LinearLayout(act);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(8), dp(6), dp(8), dp(6));
        Button closeBtn = new Button(act);
        closeBtn.setText("✕");
        closeBtn.setContentDescription("Chiudi il negozio");
        closeBtn.setAllCaps(false);
        closeBtn.setOnClickListener(v -> close());
        top.addView(closeBtn, new LinearLayout.LayoutParams(dp(52), dp(48)));
        title = new TextView(act);
        title.setTextColor(0xFF1B1E22);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setPadding(dp(8), 0, dp(8), 0);
        top.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        panel.addView(top, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        panel.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        shop = new WebView(act);
        WebSettings s = shop.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        shop.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String scheme = req.getUrl().getScheme();
                return !("http".equals(scheme) || "https".equals(scheme));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                title.setText(view.getTitle() != null ? view.getTitle() : url);
                progress.setVisibility(View.GONE);
            }
        });
        shop.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                progress.setProgress(p);
            }
        });
        panel.addView(shop, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        Button imp = new Button(act);
        imp.setText("Importa gli articoli di questa pagina");
        imp.setAllCaps(false);
        imp.setTextColor(0xFFFFFFFF);
        imp.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        imp.setBackgroundColor(0xFF1F4FD1);
        imp.setOnClickListener(v -> importPage());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56));
        lp.setMargins(dp(12), dp(8), dp(12), dp(12));
        panel.addView(imp, lp);

        root.addView(panel, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    void open(String url) {
        if (panel == null) build();
        panel.setVisibility(View.VISIBLE);
        title.setText(Uri.parse(url).getHost());
        shop.loadUrl(url);
    }

    private void importPage() {
        shop.evaluateJavascript(extractor(), value -> {
            // value è una stringa JS (JSON del risultato): la passo così com'è all'app
            if (value == null || "null".equals(value)) value = "\"{\\\"items\\\":[]}\"";
            close();
            main.evaluateJavascript("window.CasaMia && CasaMia.onShopResult && CasaMia.onShopResult(" + value + ")", null);
        });
    }

    /* ---------- Aggiornamento prezzi su richiesta (pagina per pagina, nascosta) ---------- */
    @SuppressLint("SetJavaScriptEnabled")
    void refreshPrices(String json) {
        final JSONArray list;
        try {
            list = new JSONArray(json);
        } catch (Exception e) {
            return;
        }
        final JSONArray results = new JSONArray();
        final WebView hidden = new WebView(act);
        hidden.getSettings().setJavaScriptEnabled(true);
        hidden.getSettings().setDomStorageEnabled(true);
        final Handler h = new Handler(Looper.getMainLooper());
        final int[] idx = {0};
        final int[] current = {-1};
        final boolean[] waiting = {false};
        final Runnable[] next = new Runnable[1];
        next[0] = () -> {
            if (idx[0] >= list.length()) {
                hidden.destroy();
                main.evaluateJavascript("window.CasaMia && CasaMia.onPriceResults && CasaMia.onPriceResults(" + JSONObject.quote(results.toString()) + ")", null);
                return;
            }
            final int my = idx[0];
            final JSONObject it = list.optJSONObject(idx[0]++);
            current[0] = my;
            waiting[0] = true;
            hidden.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    if (!waiting[0]) return;
                    h.postDelayed(() -> {
                        if (!waiting[0]) return;
                        waiting[0] = false;
                        view.evaluateJavascript(extractor(), value -> {
                            try {
                                String s = new JSONArray("[" + value + "]").getString(0);
                                JSONArray items = new JSONObject(s).optJSONArray("items");
                                if (items != null && items.length() > 0) {
                                    JSONObject best = items.getJSONObject(0);
                                    for (int i = 0; i < items.length(); i++) {
                                        JSONObject x = items.getJSONObject(i);
                                        if (it.optString("url").equals(x.optString("url"))) {
                                            best = x;
                                            break;
                                        }
                                    }
                                    if (!best.isNull("price")) {
                                        JSONObject r = new JSONObject();
                                        r.put("id", it.optString("id"));
                                        r.put("price", best.getDouble("price"));
                                        results.put(r);
                                    }
                                }
                            } catch (Exception ignored) {
                            }
                            h.post(next[0]);
                        });
                    }, 2500);
                }
            });
            hidden.loadUrl(it.optString("url"));
            h.postDelayed(() -> {
                if (waiting[0] && current[0] == my) {
                    waiting[0] = false;
                    h.post(next[0]);
                }
            }, 25000);
        };
        h.post(next[0]);
    }
}
