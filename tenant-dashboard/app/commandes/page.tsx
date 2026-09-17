import { OrdersPageContent } from "@/components/OrdersPageContent";

/** Page Commandes mobile — accessible depuis le hub (app/page.tsx sur
 * petit écran). Sur desktop, "/" affiche déjà les commandes directement ;
 * cette route reste toutefois utilisable telle quelle (même rendu
 * desktop) si quelqu'un y accède directement depuis un grand écran. */
export default function CommandesPage() {
  return (
    <>
      <div className="md:hidden">
        <OrdersPageContent variant="mobile" />
      </div>
      <div className="hidden md:block">
        <OrdersPageContent variant="desktop" />
      </div>
    </>
  );
}
