import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import NotificationHandler from '../components/NotificationHandler';
import CallNotificationManager from '../components/CallNotificationManager';


const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Chat App - Real-time Messaging',
  description: 'Real-time chat application with Google OAuth, group chats, and push notifications',
}

export default function RootLayout({ children }) {

  
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning={true}>
        <body className={inter.className} suppressHydrationWarning={true}>
          <main className="min-h-screen">
            <NotificationHandler />
            {/* <CallNotificationManager /> */}
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  )
}