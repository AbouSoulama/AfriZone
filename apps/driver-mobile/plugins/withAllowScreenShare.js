const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android pose FLAG_SECURE sur la fenêtre (mot de passe, modules natifs, skins
 * Tecno/Samsung). Tant que ce flag est là, Meet / Zoom / WhatsApp affichent un
 * écran noir et un message de sécurité. On le retire à chaque retour au premier
 * plan, et toutes les secondes tant que l’app est visible.
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
        'import android.os.Build\nimport android.view.View\nimport android.view.WindowManager\n'
      );
    }

    if (!src.includes('super.onCreate(null)')) {
      throw new Error('withAllowScreenShare: super.onCreate(null) introuvable');
    }
    src = src.replace('super.onCreate(null)', 'super.onCreate(null)\n    allowScreenShare()');

    const injection = `
  private val clearSecureFlag = object : Runnable {
    override fun run() {
      allowScreenShare()
      window.decorView.postDelayed(this, 1000)
    }
  }

  private fun allowScreenShare() {
    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(true)
    }
    if (Build.VERSION.SDK_INT >= 35) {
      window.decorView.setContentSensitivity(View.CONTENT_SENSITIVITY_NOT_SENSITIVE)
    }
  }

  override fun onResume() {
    super.onResume()
    window.decorView.removeCallbacks(clearSecureFlag)
    window.decorView.post(clearSecureFlag)
  }

  override fun onPause() {
    window.decorView.removeCallbacks(clearSecureFlag)
    super.onPause()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    allowScreenShare()
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
