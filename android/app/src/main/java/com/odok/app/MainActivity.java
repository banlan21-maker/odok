package com.odok.app;

import android.view.ActionMode;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Android 네이티브 텍스트 선택 툴바(ActionMode)를 차단하여
    // 앱 내 커스텀 하이라이트/공유 메뉴가 정상 작동하도록 합니다.
    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) {
        return null;
    }

    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
        return null;
    }
}
