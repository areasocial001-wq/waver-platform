import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check if notifications are supported
    const supported = "Notification" in window && "serviceWorker" in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      setIsEnabled(Notification.permission === "granted");
      
      // Register service worker
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registered:", registration.scope);
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Le notifiche non sono supportate su questo browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setIsEnabled(result === "granted");
      
      if (result === "granted") {
        toast.success("Notifiche abilitate! Riceverai avvisi quando i video sono pronti.");
        return true;
      } else if (result === "denied") {
        toast.error("Notifiche bloccate. Puoi abilitarle dalle impostazioni del browser.");
        return false;
      }
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Errore nella richiesta delle notifiche");
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(async (title: string, body: string, data?: any) => {
    if (!isEnabled) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `video-${Date.now()}`,
        data,
        requireInteraction: true,
      });
    } catch (error) {
      console.error("Error showing notification:", error);
      // Fallback to basic notification
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    }
  }, [isEnabled]);

  return {
    isSupported,
    isEnabled,
    permission,
    requestPermission,
    showNotification,
  };
};
