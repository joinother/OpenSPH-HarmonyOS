import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import QAbilityStage from '../qabilitystage/QAbilityStage';
import UIAbility from '@ohos.app.ability.UIAbility';
import Want from '@ohos.app.ability.Want';
import Window from '@ohos.window'
import hilog from '@ohos.hilog';
import { BusinessError } from '@ohos.base';
import { fileIo as fs } from '@kit.CoreFileKit';
import qpa from 'libqohos.so';
import {LOG_DOMAIN, LOG_TAG} from '../common/QtAppConstants';

export default class QAbility extends UIAbility {

  private localStorage: LocalStorage | null = null;

  // 把 rawfile 里的 OpenSPH.mo 国际化词库拷贝到应用沙箱 filesDir 根目录。
  // （wxFileTranslationsLoader 需要 <prefix>/<lang>/LC_MESSAGES 子目录，这些
  // 由 native 侧 OpenSPH 启动时用 POSIX mkdir 复制补齐。）
  private _catalogBuf: Uint8Array = new Uint8Array(0);

  async copyI18nCatalogs(): Promise<void> {
    try {
      const ctx = this.context;
      hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility: filesDir=%{public}s', ctx.filesDir);
      const rm = ctx.resourceManager;
      this._catalogBuf = await rm.getRawFileContent('OpenSPH.mo');
      hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility: rawfile OpenSPH.mo size=%{public}d', this._catalogBuf.byteLength);
      const dest = `${ctx.filesDir}/OpenSPH.mo`;
      const file = fs.openSync(dest, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      fs.writeSync(file.fd, this._catalogBuf.buffer as ArrayBuffer);
      fs.closeSync(file);
      hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility: copied OpenSPH.mo (%{public}d bytes) to %{public}s', this._catalogBuf.byteLength, dest);
    } catch (e) {
      const be = e as BusinessError;
      hilog.error(LOG_DOMAIN, LOG_TAG, 'QAbility: copy i18n catalog failed: code=%{public}d msg=%{public}s', be.code, be.message);
    }
  }

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam) {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onCreate(): want.parameters: ' + JSON.stringify(want.parameters));
    QAbilityStage.initQtAppContextIfNeeded(this.context.getApplicationContext());
    // 尽早部署 i18n 词库，OpenSPH native 侧会轮询等待其就绪
    this.copyI18nCatalogs();
    qpa.handleAbilityOnCreate(this, want, launchParam);
  }

  onDestroy(): void | Promise<void> {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onDestroy()');
    return qpa.handleAbilityOnDestroy(this);
  }

  onPrepareToTerminate(): boolean {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onPrepareToTerminate()');
    return qpa.handleAbilityOnPrepareToTerminate(this);
  }

  onPrepareToTerminateAsync(): Promise<boolean> {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onPrepareToTerminateAsync()');
    return qpa.handleAbilityOnPrepareToTerminateAsync(this);
  }

  onWindowStageCreate(windowStage: Window.WindowStage) {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onWindowStageCreate(): this.launchWant.parameters: ' + JSON.stringify(this.launchWant.parameters));
    qpa.handleAbilityOnWindowStageCreate(this, windowStage);
  }

  onWindowStageRestore(windowStage: Window.WindowStage): void {
    qpa.handleAbilityOnWindowStageRestore(this, windowStage);
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onNewWant(): want.parameters: ' + JSON.stringify(want.parameters));
    qpa.handleAbilityOnNewWant(this, want, launchParam);
  }

  onForeground() {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onForeground()');
    qpa.handleAbilityOnForeground(this);
  }

  onBackground() {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onBackground()');
    qpa.handleAbilityOnBackground(this);
  }

  onWindowStageDestroy() {
    hilog.info(LOG_DOMAIN, LOG_TAG, 'QAbility::onStageDestroy()');
    qpa.handleAbilityOnWindowStageDestroy(this);
  }

  onContinue(wantParam: Record<string, Object>): AbilityConstant.OnContinueResult | Promise<AbilityConstant.OnContinueResult> {
    return qpa.handleAbilityOnContinue(this, wantParam);
  }
}
