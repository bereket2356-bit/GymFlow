import Icon from "./Icon.jsx";

export default function Toast({ toast, onDismiss }) {
  return (
    <div className={"toast" + (toast.tone ? " toast--" + toast.tone : "")} role="status">
      <div className="toast-body">{toast.message}</div>
      <button className="toast-x" type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <Icon name="close" />
      </button>
    </div>
  );
}