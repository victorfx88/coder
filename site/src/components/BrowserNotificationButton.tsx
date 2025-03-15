import { FC, useState } from 'react';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Snackbar from '@mui/material/Snackbar';
import { API } from 'api';
import { useBuildInfo } from 'hooks/useBuildInfo';
import { useMe } from 'hooks/useMe';

export const BrowserNotificationButton: FC = () => {
  const buildInfo = useBuildInfo();
  const me = useMe();
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  if (!buildInfo || !me) {
    return null;
  }

  const vapidPublicKey = buildInfo.data?.notifications_vapid_public_key;

  if (!vapidPublicKey) {
    return null;
  }

  const handleSubscribe = async () => {
    try {
      setSubscribeStatus('subscribing');
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setSubscribeStatus('error');
        setErrorMessage('Notification permission denied. Please enable notifications in your browser settings.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      // Convert subscription to the format the API expects
      const subscriptionJson = subscription.toJSON();
      await API.updateUserBrowserNotificationSubscription(me.data?.id ?? 'me', {
        subscription: {
          endpoint: subscriptionJson.endpoint!,
          keys: subscriptionJson.keys as any,
        },
      });

      setSubscribeStatus('subscribed');
      setShowSuccess(true);
    } catch (error) {
      setSubscribeStatus('error');
      setErrorMessage(`Error subscribing to notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const buttonDisabled = subscribeStatus === 'subscribing' || subscribeStatus === 'subscribed';

  return (
    <>
      <Tooltip title="Enable browser notifications">
        <Button
          variant="outlined"
          startIcon={<NotificationsIcon />}
          onClick={handleSubscribe}
          disabled={buttonDisabled}
          size="small"
        >
          {subscribeStatus === 'subscribing' 
            ? 'Subscribing...' 
            : subscribeStatus === 'subscribed' 
              ? 'Subscribed' 
              : 'Enable Notifications'}
        </Button>
      </Tooltip>

      {subscribeStatus === 'error' && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
        message="You have successfully subscribed to browser notifications"
      />
    </>
  );
};