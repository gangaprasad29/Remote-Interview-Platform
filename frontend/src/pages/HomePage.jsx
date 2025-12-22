import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast"


function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 gap-6">
      <h1 className="text-4xl font-bold text-primary">
        Welcome to Remote Interview Platform
      </h1>

      <div>
        <button
  className="btn btn-secondary"
  onClick={() => toast.success("this is a success toast")}
>
  click me
</button>
      </div>

      {/* If user is signed out */}
      <SignedOut>
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <button className="btn btn-primary">Sign In</button>
          </SignInButton>

          <SignUpButton mode="modal">
            <button className="btn btn-secondary">Sign Up</button>
          </SignUpButton>
        </div>
      </SignedOut>

      {/* If user is signed in */}
      <SignedIn>
        <div className="flex flex-col items-center gap-4">
          <UserButton afterSignOutUrl="/" />
          <button
            className="btn btn-success"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </button>
        </div>
      </SignedIn>
    </div>
  );
}

export default HomePage;
