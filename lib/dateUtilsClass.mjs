/**
 * This supports Cacher. pulled 4/10/2023
 * See Blog for usage/tutorial: https://ramblings.mcpher.com/apps-script/apps-script-caching-enhanced/
 * See Github page: https://github.com/brucemcpherson/bmCachePoint
 */
// mcpher.Compress.gs
// v12 - baselined functional from deployment v12 and later.
// v50 baseline.

const du = (() => {
  const add = (a, b) => {
    return a + b;
  }
  return {
    add,
  };
})();
export default du;