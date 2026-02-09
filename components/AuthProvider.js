import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { setAuthToken } from '../lib/api';

export const AuthProvider = ({ children }) => {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    const initializeAuth = async () => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          console.log('AuthProvider: Setting token from Clerk');
          setAuthToken(token);
        } catch (error) {
          console.error('AuthProvider: Error getting token', error);
        }
      } else {
        console.log('AuthProvider: User not signed in, clearing token');
        setAuthToken(null);
      }
    };

    initializeAuth();
  }, [isSignedIn, getToken]);

  return children;
};