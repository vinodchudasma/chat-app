'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ChatDashboard from '../components/ChatDashboard';
import LoadingSpinner from '../components/LoadingSpinner';
import WindowControls from '../components/WindowControls';


export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null; // or return <LoadingSpinner /> while redirecting
  }

  return ( 
    <>

    <WindowControls />
  <ChatDashboard />
  </>
  );
}