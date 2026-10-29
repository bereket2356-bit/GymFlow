import { useId } from "react";

/**
 * Card with the prototype's head / body / foot structure.
 * `title` is optional; `actions` sit on the right of the head.
 */
export default function Card({ title, sub, actions, footer, children, className = "", bodyClass = "", ...rest }) {
  const id = useId();
  const headingId = title ? "card-title-" + id : undefined;
  return (
    <section className={"card " + className} aria-labelledby={headingId} {...rest}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && (
              <h2 className="card-title" id={headingId}>
                {title}
              </h2>
            )}
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children != null && <div className={bodyClass || "card-body"}>{children}</div>}
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}