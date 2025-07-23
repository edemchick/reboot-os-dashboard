import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow @rebootmotion.com emails
      if (user.email && user.email.endsWith('@rebootmotion.com')) {
        return true
      }
      return false
    },
    async session({ session, token }) {
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
})
