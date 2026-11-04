"use client";

/* The phone input and its stylesheet, in one module so the dynamic import in Form.tsx pulls both
   together. Importing the stylesheet from Form.tsx put ~64 KB of flag-picker CSS into the
   render-blocking (now inlined) CSS of every page carrying the form, the homepage included, although
   the real input only loads when the visitor nears the form. The placeholder input that stands in until
   then is styled by tokens.css (.formsec .PhoneInput*), so nothing moves when this arrives. */
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

export default PhoneInput;
