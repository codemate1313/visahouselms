import { Navigate, useLocation } from "react-router-dom";

/**
 * `/institute-signup` is where every footer points, but the application form
 * itself lives on the contact page, in the lander's own design language.
 *
 * There was briefly a second form here. Two implementations of one application
 * meant a visitor saw different fields depending on which link they followed,
 * so this path now forwards rather than duplicating - preserving `?plan=` so
 * the tier they were looking at survives the hop and setting `form=partner`.
 */
export function InstituteSignupRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (!params.has("form") && !params.has("plan")) {
    params.set("form", "partner");
  }
  const searchStr = params.toString();
  return <Navigate replace to={`/contact${searchStr ? `?${searchStr}` : ""}`} />;
}

