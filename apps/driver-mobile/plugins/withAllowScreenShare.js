const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android bloque la capture et le partage d’écran (Meet, Zoom, WhatsApp) de
 * deux façons : FLAG_SECURE sur la fenêtre, et — depuis Android 15 — toute
 * vue « sensible » (champ mot de passe). Dès qu’une seule vue l’est, c’est
 * toute la fenêtre qui devient noire. On retire le flag et on marque chaque
 * vue comme non sensible à chaque frame affichée.
 */
function withAllowScreenShare(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withAllowScreenShare: MainActivity doit être en Kotlin');
    }

    let src = cfg.modResults.contents;
    if (src.includes('fun allowScreenShare(')) {
      cfg.modResults.contents = src;
      return cfg;
    }

    if (!src.includes('import android.view.WindowManager')) {
      if (!src.includes('import android.os.Build')) {
        throw new Error('withAllowScreenShare: import android.os.Build introuvable');
      }
      src = src.replace(
        'import android.os.Build\n',
        'import android.os.Build\nimport android.view.View\nimport android.view.ViewGroup\nimport android.view.ViewTreeObserver\nimport android.view.WindowManager\n'
      );
    }

    if (!src.includes('super.onCreate(null)')) {
      throw new Error('withAllowScreenShare: super.onCreate(null) introuvable');
    }
    src = src.replace('super.onCreate(null)', 'super.onCreate(null)\n    allowScreenShare()');

    const injection = `
  private val clearSecureFlag = ViewTreeObserver.OnPreDrawListener {
    try {
      allowScreenShare()
    } catch (_: Throwable) {
    }
    true
  }

  private fun allowScreenShare() {
    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    val attrs = window.attributes
    if (attrs.flags and WindowManager.LayoutParams.FLAG_SECURE != 0) {
      attrs.flags = attrs.flags and WindowManager.LayoutParams.FLAG_SECURE.inv()
      window.attributes = attrs
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(true)
    }
    if (Build.VERSION.SDK_INT >= 35) {
      markNotSensitive(window.decorView)
    }
  }

  private fun markNotSensitive(view: View) {
    if (Build.VERSION.SDK_INT < 35) return
    if (view.contentSensitivity != View.CONTENT_SENSITIVITY_NOT_SENSITIVE) {
      view.setContentSensitivity(View.CONTENT_SENSITIVITY_NOT_SENSITIVE)
    }
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        markNotSensitive(view.getChildAt(i))
      }
    }
  }

  private fun startClearingSecureFlag() {
    val observer = window.decorView.viewTreeObserver
    if (observer.isAlive) {
      observer.removeOnPreDrawListener(clearSecureFlag)
      observer.addOnPreDrawListener(clearSecureFlag)
    }
    allowScreenShare()
  }

  override fun onResume() {
    super.onResume()
    startClearingSecureFlag()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) startClearingSecureFlag()
  }

`;

    const anchor = 'override fun getMainComponentName()';
    if (!src.includes(anchor)) {
      throw new Error('withAllowScreenShare: getMainComponentName introuvable');
    }
    src = src.replace(anchor, `${injection}  ${anchor}`);

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = withAllowScreenShare;
