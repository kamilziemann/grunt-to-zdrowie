// Zmienne builda Vite (`VITE_*` trafiaja do bundla - tylko wartosci publiczne).
interface ImportMetaEnv {
  /** pelny adres serwisu (canonical, hreflang); brak = strony bez adresow absolutnych */
  readonly VITE_SITE_URL?: string;
}
