import { LeafSprig } from "./decor";
import { Reveal } from "./reveal";
import { SectionHeading } from "./typography";

/** Top of every inner page: two-weight heading, short rule and one line, on cream. */
export function PageIntro({
  strong,
  soft,
  line,
  id = "page-heading",
  children,
}: {
  strong: string;
  soft?: string;
  line?: string;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden pt-10 pb-8 md:pt-20 md:pb-12">
      <LeafSprig className="pointer-events-none absolute -top-4 -right-8 w-24 -scale-x-100 opacity-90 md:w-36" />
      <div className="container-page">
        <Reveal>
          <SectionHeading as="h1" id={id} strong={strong} soft={soft} />
          {line && <p className="text-body mt-6 max-w-2xl">{line}</p>}
          {children}
        </Reveal>
      </div>
    </header>
  );
}
