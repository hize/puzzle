import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        if window == nil {
            let newWindow = UIWindow(windowScene: windowScene)
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            newWindow.rootViewController = storyboard.instantiateInitialViewController()
            window = newWindow
        }
        window?.makeKeyAndVisible()

        hideWebViewScrollIndicators()

        // 冷启动时由 URL / Universal Link 唤起的情况
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        if let userActivity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared,
                                                             continue: userActivity,
                                                             restorationHandler: { _ in })
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        // Called as the scene is being released by the system.
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        hideWebViewScrollIndicators()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Called when the scene will move from an active state to an inactive state.
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Called as the scene transitions from the background to the foreground.
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Called as the scene transitions from the foreground to the background.
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared,
                                                         continue: userActivity,
                                                         restorationHandler: { _ in })
    }

    private var scrollIndicatorRetryCount = 0

    /// 隐藏 WKWebView 的原生滚动指示器（页面右侧滚动条）
    private func hideWebViewScrollIndicators() {
        guard let root = window?.rootViewController else { return }
        var target: UIViewController? = root
        if let nav = root as? UINavigationController {
            target = nav.topViewController
        }
        guard let bridgeVC = target as? CAPBridgeViewController,
              let webView = bridgeVC.webView else {
            // webView 可能尚未创建，延迟重试（限定次数，避免无限循环）
            guard scrollIndicatorRetryCount < 10 else { return }
            scrollIndicatorRetryCount += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                self?.hideWebViewScrollIndicators()
            }
            return
        }
        scrollIndicatorRetryCount = 0
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false
    }
}
