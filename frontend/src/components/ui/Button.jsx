const VARIANTS = {
  default: "btn",
  primary: "btn btn-primary",
  danger: "btn btn-danger",
  ghost: "btn btn-ghost",
};

/** Button with the prototype's variants. Focus rings use the accent token. */
export default function Button({ variant = "default", size, className = "", type = "button", ...rest }) {
  const classes = [VARIANTS[variant] || VARIANTS.default, size === "sm" ? "btn-sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}