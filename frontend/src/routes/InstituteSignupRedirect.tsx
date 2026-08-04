import { Navigate, useLocation } from "react-router-dom";

/**
 * `/institute-signup` is where every footer points, but the application form
 * itself lives on the contact page, in the lander's own design language.
 *
 * There was briefly a second form here. Two implementations of one application
 * meant a visitor saw different fields depending on which link they followed,
 * so this path now forwards rather than duplicating - preserving `?plan=` so
 * the tier they were looking at survives the hop.
 */
export function InstituteSignupRedirect() {
  const { search } = useLocation();
  return <Navigate replace to={`/contact${search}`} />;
}
