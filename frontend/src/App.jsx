import './App.css'
import { SignedIn, SignedOut, SignIn ,SignInButton, SignOutButton, UserButton } from '@clerk/clerk-react'

function App() {

  return (
    <div style={{ padding: 40 }}>
      <h1>Welcome To App</h1>
      <SignedOut>
        <SignInButton mode='modal'/>
      </SignedOut>

      <SignedIn>
        <SignOutButton />
      </SignedIn>

      <UserButton />
    </div>
  )
}

export default App
