import { useState } from "react";
import { Outlet } from "react-router-dom";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { LoginModal } from "./LoginModal";

export function LandingLayout() {
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  return (
    <div className="landing-layout-root">
      <LandingHeader onOpenLogin={() => setLoginModalOpen(true)} />
      <main className="landing-main-content">
        <Outlet context={{ openLoginModal: () => setLoginModalOpen(true) }} />
      </main>
      <LandingFooter />
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </div>
  );
}
