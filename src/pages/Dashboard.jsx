import { clearAccess } from "@/lib/accessSession";
import { useEffect, useState } from "react";
import { Menu as MenuIcon } from "lucide-react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ExitIcon } from "@/components/ReferenceIcons";
import { useNavigate } from "react-router-dom";
import ObfuscationTab from "@/components/ObfuscationTab";
import { Button } from "@/components/ui/button";
import chatLandscape from "@/assets/chat-landscape.png.asset.json";
import "@/obfuscation.css";
function Dashboard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.title = "Lurapy | Obfuscation";
  }, []);
  useEffect(() => {
    document.documentElement.classList.remove("light");
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => root.classList.add("obf-pointer");
    const keyboard = () => root.classList.remove("obf-pointer");
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
      root.classList.remove("obf-pointer");
    };
  }, []);
  const onOpenChange = (next) => setOpen(next);
  return <div className="obf-app">
    <img className="obf-chat-landscape" src={chatLandscape.url} onError={(event) => {
    const image = event.currentTarget;
    if (!image.dataset.fallback) {
      image.dataset.fallback = "true";
      image.src = "/landscape/chat-landscape.webp";
    }
  }} alt="" aria-hidden="true" />
    <div className="obf-window">
    <header className="obf-header">
      <div className="obf-header-inner">
        <div className="obf-header-actions">
          <Menu.Root open={open} onOpenChange={onOpenChange}><Menu.Trigger asChild><Button variant="ghost" size="icon" aria-label="Menu" title="Menu"><MenuIcon /></Button></Menu.Trigger><Menu.Portal><Menu.Content className="obf-composer-menu obf-main-menu" align="end" sideOffset={10} collisionPadding={12}>
            <div className="obf-menu-label">LURAPY</div>
            <Menu.Item className="obf-menu-item obf-menu-action" onSelect={() => {
    clearAccess();
    navigate("/login", { replace: true });
  }}>
              <span className="obf-menu-icon"><ExitIcon /></span>
              <span className="obf-menu-text"><strong>Sair</strong><span className="obf-option-description">Encerrar o acesso neste navegador</span></span>
            </Menu.Item>
          </Menu.Content></Menu.Portal></Menu.Root>
        </div>
      </div>
    </header>
    <main className="obf-main obf-chat-main"><ObfuscationTab /></main>
  </div></div>;
}
export {
  Dashboard as default
};
