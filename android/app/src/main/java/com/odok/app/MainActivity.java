package com.odok.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.ActionMode;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
    }

    // FCM 알림 채널 생성 (Android 8.0+)
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "odok_default",
                "오독오독 알림",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("댓글, 팔로우 등 활동 알림");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

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

    // API 23+ 플로팅 ActionMode 포함 모든 유형을 확실히 제거
    // onWindowStartingActionMode의 null 리턴은 "기본 동작 사용" 의미이므로
    // 생성된 ActionMode를 즉시 finish()하여 네이티브 툴바 표시를 차단합니다.
    @Override
    public void onActionModeStarted(ActionMode mode) {
        if (mode != null) {
            mode.finish();
        }
    }
}
