declare module "select2/dist/js/select2.js" {
  import jquery from "jquery";
  const register: (root: Window, instance: typeof jquery) => typeof jquery;
  export default register;
}
