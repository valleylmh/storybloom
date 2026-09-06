App({
  onLaunch() {
    // Narration is always user-started. On iOS, media playback should remain
    // audible with the ringer silenced; the device's media volume still applies.
    // InnerAudioContext.obeyMuteSwitch is deprecated: set this globally instead.
    wx.setInnerAudioOption({
      obeyMuteSwitch: false,
      speakerOn: true,
      fail() {
        wx.showToast({ title: "声音设置失败，请关闭手机静音后重试", icon: "none" });
      },
    });
  },
});
