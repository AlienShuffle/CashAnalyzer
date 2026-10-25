# Trend-carry counterfactual

Range: 2015-01-01 through 2026-10-25; 208 eligible dates.

Observed settlement quotes, repo rates, dates, bond universes, and seasonal factors are unchanged.
CPI is anchored at observation settlement. Daily NSA CPI is multiplied by exp((trend minus actual settlement-to-horizon log carry) times ACT/365 years since settlement).
The prior six-month SA trend is taken from the latest already-known release. The endpoint NSA carry equals this trend; interior daily variation is retained with a smooth log tilt.
Apply the identical proportional tilt to SA CPI: NSA/SA seasonal factors and all full/decay seasonal ratios remain unchanged. This is not a seasonally neutral NSA path.
Intervening indexed coupons and forward clean prices are recomputed by the production pricer, including repo carry of coupons.
Refit training clean prices use the archived curve publisher's six-decimal rounding; actual-path recalibrations must reproduce the archived rates.
svensson-fixed and flat-fixed hold each saved transformed longer-end reference fixed; flat-refit recalibrates the same three training bonds under the trend path. No new Svensson fit is performed.
All predictions/errors are on original observed settlement price/yield basis. Positive counterfactual improvement means actual error squared minus trend-path error squared.
Toward means smaller absolute price residual; through means the signed price residual changes sign. These can occur together.
Carry-gap relationship tables instead retain settlement-error-squared minus forward-error-squared; actual and trend scenarios use identical original announcement-based gap labels.
Episode-balanced means and paired 2,000-resample episode-bootstrap price-improvement intervals use fixed seed 1729. Serial dependence, repeated securities, and multiplicity remain unmodeled.
This is a mechanical sensitivity, not counterfactual market prices, a causal CPI effect, realized returns, or prospective validation.
The 0–6-month sample is bid-only; overlapping buckets and many exploratory comparisons are not independent evidence.

## Primary 6–12-month forward comparisons

Price RMSE is clean price per 100; yield RMSE is bp. The interval is for paired squared-price-error improvement, not RMSE.

| Method | Cutoff months | Adjustment | State | Episodes | Actual price RMSE | Trend price RMSE | Actual yield RMSE | Trend yield RMSE | Squared-price improvement [95%] | Toward | Through |
|---|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|
| svensson-fixed | 12 | none | all | 106 | 1.20566 | 1.18299 | 198.68258 | 195.55439 | 0.05413 [-0.03537, 0.14275] | 56.2% | 16.8% |
| svensson-fixed | 12 | none | below | 43 | 1.38402 | 1.32124 | 229.36360 | 219.43066 | 0.16982 [0.05629, 0.30202] | 68.4% | 17.0% |
| svensson-fixed | 12 | none | near | 21 | 0.81543 | 0.81887 | 116.89747 | 117.58868 | -0.00562 [-0.03037, 0.01664] | 44.4% | 9.9% |
| svensson-fixed | 12 | none | above | 42 | 1.17263 | 1.18722 | 197.31714 | 200.75988 | -0.03443 [-0.21982, 0.14667] | 49.5% | 20.1% |
| svensson-fixed | 18 | none | all | 106 | 2.64305 | 2.66645 | 441.51662 | 444.48454 | -0.12424 [-0.41047, 0.08993] | 36.7% | 19.6% |
| svensson-fixed | 18 | none | below | 43 | 3.50182 | 3.50715 | 603.95634 | 604.26670 | -0.03739 [-0.71054, 0.47166] | 38.8% | 17.7% |
| svensson-fixed | 18 | none | near | 21 | 2.50376 | 2.50912 | 359.23594 | 359.53648 | -0.02688 [-0.14369, 0.05516] | 41.1% | 5.4% |
| svensson-fixed | 18 | none | above | 42 | 1.39338 | 1.48436 | 232.40123 | 245.26509 | -0.26184 [-0.40657, -0.13728] | 32.3% | 28.7% |
| svensson-fixed | 24 | none | all | 106 | 4.95777 | 4.94395 | 829.85352 | 827.07897 | 0.13677 [-0.40759, 0.64925] | 55.1% | 15.3% |
| svensson-fixed | 24 | none | below | 43 | 6.25175 | 6.23489 | 1079.31067 | 1072.61845 | 0.21047 [-0.88534, 1.12788] | 56.9% | 14.1% |
| svensson-fixed | 24 | none | near | 21 | 4.01938 | 4.02184 | 642.91316 | 643.27179 | -0.01981 [-0.20777, 0.15878] | 55.0% | 2.2% |
| svensson-fixed | 24 | none | above | 42 | 3.73379 | 3.71505 | 581.99877 | 584.49419 | 0.13959 [-0.64799, 0.98928] | 53.4% | 23.0% |
| svensson-fixed | 12 | sa | all | 106 | 0.30724 | 0.43329 | 57.50076 | 69.98636 | -0.09334 [-0.12821, -0.05989] | 27.4% | 35.9% |
| svensson-fixed | 12 | sa | below | 43 | 0.42311 | 0.52880 | 83.34110 | 92.26632 | -0.10060 [-0.15250, -0.05213] | 26.2% | 45.9% |
| svensson-fixed | 12 | sa | near | 21 | 0.15772 | 0.15855 | 23.60352 | 24.01972 | -0.00026 [-0.00479, 0.00479] | 49.0% | 9.5% |
| svensson-fixed | 12 | sa | above | 42 | 0.20620 | 0.41829 | 30.90128 | 57.94487 | -0.13245 [-0.19411, -0.07357] | 18.0% | 38.9% |
| svensson-fixed | 18 | sa | all | 106 | 0.83017 | 0.86686 | 128.65656 | 132.43228 | -0.06226 [-0.10896, -0.00925] | 33.5% | 29.6% |
| svensson-fixed | 18 | sa | below | 43 | 0.97104 | 0.98949 | 164.24217 | 165.52439 | -0.03617 [-0.12043, 0.06949] | 28.5% | 28.7% |
| svensson-fixed | 18 | sa | near | 21 | 0.84731 | 0.86321 | 98.20906 | 100.28372 | -0.02721 [-0.07874, 0.00125] | 46.8% | 10.1% |
| svensson-fixed | 18 | sa | above | 42 | 0.64423 | 0.72217 | 96.61836 | 105.75574 | -0.10650 [-0.17871, -0.03782] | 31.9% | 40.2% |
| svensson-fixed | 24 | sa | all | 106 | 1.54110 | 1.55914 | 254.20766 | 254.89478 | -0.05592 [-0.12662, 0.01842] | 40.6% | 27.3% |
| svensson-fixed | 24 | sa | below | 43 | 1.93235 | 1.94189 | 332.58414 | 330.66946 | -0.03698 [-0.17262, 0.11970] | 36.6% | 23.6% |
| svensson-fixed | 24 | sa | near | 21 | 1.86976 | 1.86712 | 284.00504 | 283.79829 | 0.00987 [-0.00280, 0.02149] | 58.3% | 7.3% |
| svensson-fixed | 24 | sa | above | 42 | 0.65051 | 0.72895 | 97.55606 | 108.43845 | -0.10821 [-0.22603, -0.02124] | 35.7% | 41.1% |
| svensson-fixed | 12 | sa-decay | all | 106 | 0.45077 | 0.53129 | 86.25152 | 92.62337 | -0.07907 [-0.11780, -0.03605] | 28.9% | 34.9% |
| svensson-fixed | 12 | sa-decay | below | 43 | 0.68001 | 0.72707 | 132.40259 | 133.98085 | -0.06623 [-0.13484, 0.01427] | 29.9% | 39.7% |
| svensson-fixed | 12 | sa-decay | near | 21 | 0.18885 | 0.19028 | 28.45387 | 28.99569 | -0.00054 [-0.00593, 0.00538] | 47.4% | 9.3% |
| svensson-fixed | 12 | sa-decay | above | 42 | 0.14688 | 0.39123 | 20.56181 | 53.41665 | -0.13149 [-0.18907, -0.07608] | 18.6% | 42.9% |
| svensson-fixed | 18 | sa-decay | all | 106 | 0.81632 | 0.86295 | 121.52961 | 127.29296 | -0.07831 [-0.12092, -0.03576] | 32.7% | 32.3% |
| svensson-fixed | 18 | sa-decay | below | 43 | 0.73844 | 0.77365 | 122.34408 | 125.85306 | -0.05325 [-0.11597, 0.01488] | 29.4% | 29.9% |
| svensson-fixed | 18 | sa-decay | near | 21 | 1.04784 | 1.06337 | 121.27953 | 123.35239 | -0.03278 [-0.09438, 0.00020] | 43.7% | 11.1% |
| svensson-fixed | 18 | sa-decay | above | 42 | 0.75799 | 0.83742 | 120.81577 | 130.65421 | -0.12673 [-0.19885, -0.05767] | 30.7% | 45.2% |
| svensson-fixed | 24 | sa-decay | all | 106 | 2.01492 | 2.03166 | 333.09205 | 333.71108 | -0.06772 [-0.19953, 0.06081] | 38.5% | 26.2% |
| svensson-fixed | 24 | sa-decay | below | 43 | 2.69231 | 2.68263 | 460.38751 | 456.16235 | 0.05204 [-0.13868, 0.29280] | 34.9% | 21.3% |
| svensson-fixed | 24 | sa-decay | near | 21 | 1.57599 | 1.57548 | 215.10188 | 214.42770 | 0.00159 [-0.07449, 0.06163] | 49.4% | 7.5% |
| svensson-fixed | 24 | sa-decay | above | 42 | 1.25836 | 1.34478 | 199.69926 | 212.20539 | -0.22497 [-0.50223, -0.05294] | 36.7% | 40.6% |
| flat-fixed | 12 | none | all | 106 | 0.34733 | 0.42777 | 53.27741 | 63.41115 | -0.06235 [-0.09768, -0.02566] | 43.2% | 25.1% |
| flat-fixed | 12 | none | below | 43 | 0.34274 | 0.47775 | 54.84184 | 72.01370 | -0.11078 [-0.18338, -0.04462] | 41.8% | 22.8% |
| flat-fixed | 12 | none | near | 21 | 0.34133 | 0.35779 | 52.15871 | 55.16854 | -0.01151 [-0.03260, 0.00807] | 45.0% | 3.6% |
| flat-fixed | 12 | none | above | 42 | 0.35488 | 0.40513 | 52.19470 | 57.59288 | -0.03819 [-0.09016, 0.01212] | 43.7% | 38.2% |
| flat-refit | 12 | none | all | 106 | 0.34733 | 0.35781 | 53.27741 | 55.27268 | -0.00739 [-0.02341, 0.01003] | 50.2% | 13.0% |
| flat-refit | 12 | none | below | 43 | 0.34274 | 0.38347 | 54.84184 | 61.18797 | -0.02958 [-0.06090, 0.00015] | 48.5% | 8.8% |
| flat-refit | 12 | none | near | 21 | 0.34133 | 0.34923 | 52.15871 | 53.74506 | -0.00546 [-0.01684, 0.00590] | 45.6% | 1.6% |
| flat-refit | 12 | none | above | 42 | 0.35488 | 0.33405 | 52.19470 | 49.32582 | 0.01435 [-0.00876, 0.03854] | 54.1% | 23.0% |
| flat-fixed | 18 | none | all | 106 | 0.39594 | 0.47955 | 59.93470 | 70.77722 | -0.07320 [-0.11510, -0.02977] | 44.5% | 19.8% |
| flat-fixed | 18 | none | below | 43 | 0.40510 | 0.54052 | 63.31055 | 81.38316 | -0.12805 [-0.20874, -0.04882] | 45.0% | 17.2% |
| flat-fixed | 18 | none | near | 21 | 0.39340 | 0.41032 | 58.67903 | 61.65969 | -0.01360 [-0.03827, 0.00931] | 42.1% | 2.0% |
| flat-fixed | 18 | none | above | 42 | 0.38763 | 0.44396 | 56.92691 | 62.93597 | -0.04685 [-0.10812, 0.01268] | 45.1% | 31.3% |
| flat-refit | 18 | none | all | 106 | 0.39594 | 0.42483 | 59.93470 | 64.33894 | -0.02371 [-0.04720, 0.00159] | 48.3% | 13.7% |
| flat-refit | 18 | none | below | 43 | 0.40510 | 0.46919 | 63.31055 | 73.02053 | -0.05603 [-0.10294, -0.01036] | 48.0% | 10.4% |
| flat-refit | 18 | none | near | 21 | 0.39340 | 0.40310 | 58.67903 | 60.50707 | -0.00773 [-0.02373, 0.00788] | 42.5% | 1.4% |
| flat-refit | 18 | none | above | 42 | 0.38763 | 0.38584 | 56.92691 | 56.19435 | 0.00138 [-0.03227, 0.03525] | 51.6% | 23.3% |
| flat-fixed | 24 | none | all | 106 | 0.45638 | 0.52714 | 67.73469 | 76.95348 | -0.06959 [-0.11646, -0.01866] | 44.7% | 17.6% |
| flat-fixed | 24 | none | below | 43 | 0.44100 | 0.57275 | 67.63219 | 85.22232 | -0.13357 [-0.22875, -0.04415] | 46.0% | 14.1% |
| flat-fixed | 24 | none | near | 21 | 0.44013 | 0.45835 | 65.49932 | 68.67506 | -0.01636 [-0.04495, 0.00948] | 44.0% | 2.0% |
| flat-fixed | 24 | none | above | 42 | 0.47928 | 0.51031 | 68.92828 | 71.77527 | -0.03071 [-0.09517, 0.03671] | 43.6% | 28.9% |
| flat-refit | 24 | none | all | 106 | 0.45638 | 0.48716 | 67.73469 | 72.25727 | -0.02904 [-0.06012, 0.00507] | 46.7% | 12.5% |
| flat-refit | 24 | none | below | 43 | 0.44100 | 0.51647 | 67.63219 | 78.62588 | -0.07227 [-0.13150, -0.01400] | 48.0% | 9.3% |
| flat-refit | 24 | none | near | 21 | 0.44013 | 0.45260 | 65.49932 | 67.77912 | -0.01113 [-0.03176, 0.00779] | 44.0% | 0.6% |
| flat-refit | 24 | none | above | 42 | 0.47928 | 0.47270 | 68.92828 | 67.46013 | 0.00627 [-0.03719, 0.05201] | 46.7% | 21.8% |
| flat-fixed | 12 | sa | all | 106 | 0.23051 | 0.42101 | 36.25132 | 61.20022 | -0.12411 [-0.16800, -0.08278] | 29.6% | 28.5% |
| flat-fixed | 12 | sa | below | 43 | 0.27160 | 0.50412 | 44.90241 | 75.89231 | -0.18037 [-0.27057, -0.10502] | 27.6% | 28.8% |
| flat-fixed | 12 | sa | near | 21 | 0.20347 | 0.21377 | 29.48896 | 31.50520 | -0.00430 [-0.01343, 0.00424] | 45.8% | 11.5% |
| flat-fixed | 12 | sa | above | 42 | 0.19464 | 0.40533 | 28.59464 | 55.31528 | -0.12641 [-0.18719, -0.06948] | 23.4% | 36.6% |
| flat-refit | 12 | sa | all | 106 | 0.23051 | 0.30142 | 36.25132 | 46.86186 | -0.03772 [-0.05680, -0.02034] | 39.1% | 19.5% |
| flat-refit | 12 | sa | below | 43 | 0.27160 | 0.36863 | 44.90241 | 59.79129 | -0.06212 [-0.10649, -0.02845] | 33.4% | 18.3% |
| flat-refit | 12 | sa | near | 21 | 0.20347 | 0.20671 | 29.48896 | 30.30590 | -0.00133 [-0.00608, 0.00341] | 49.4% | 5.4% |
| flat-refit | 12 | sa | above | 42 | 0.19464 | 0.26231 | 28.59464 | 37.72308 | -0.03092 [-0.05351, -0.00934] | 39.8% | 27.8% |
| flat-fixed | 18 | sa | all | 106 | 0.30174 | 0.47274 | 45.29022 | 68.07918 | -0.13244 [-0.18256, -0.08349] | 31.6% | 25.3% |
| flat-fixed | 18 | sa | below | 43 | 0.34734 | 0.57539 | 54.71678 | 85.37839 | -0.21043 [-0.31868, -0.11903] | 28.2% | 23.3% |
| flat-fixed | 18 | sa | near | 21 | 0.27080 | 0.27942 | 37.69431 | 39.56217 | -0.00475 [-0.01785, 0.00790] | 44.2% | 8.7% |
| flat-fixed | 18 | sa | above | 42 | 0.26381 | 0.43132 | 37.43269 | 58.75098 | -0.11644 [-0.18179, -0.05488] | 28.8% | 35.7% |
| flat-refit | 18 | sa | all | 106 | 0.30174 | 0.38967 | 45.29022 | 58.16347 | -0.06080 [-0.08898, -0.03332] | 38.0% | 20.4% |
| flat-refit | 18 | sa | below | 43 | 0.34734 | 0.47914 | 54.71678 | 74.11598 | -0.10893 [-0.17596, -0.05458] | 33.7% | 18.3% |
| flat-refit | 18 | sa | near | 21 | 0.27080 | 0.27454 | 37.69431 | 38.67612 | -0.00204 [-0.01027, 0.00590] | 45.8% | 3.4% |
| flat-refit | 18 | sa | above | 42 | 0.26381 | 0.33242 | 37.43269 | 46.54170 | -0.04090 [-0.07251, -0.01050] | 38.5% | 31.1% |
| flat-fixed | 24 | sa | all | 106 | 0.35530 | 0.51349 | 51.76310 | 73.06072 | -0.13744 [-0.19356, -0.08261] | 35.6% | 20.7% |
| flat-fixed | 24 | sa | below | 43 | 0.39318 | 0.61396 | 59.94780 | 89.79977 | -0.22236 [-0.34383, -0.12070] | 33.1% | 20.1% |
| flat-fixed | 24 | sa | near | 21 | 0.31722 | 0.32478 | 43.65564 | 45.37907 | -0.00485 [-0.02032, 0.01064] | 45.2% | 4.6% |
| flat-fixed | 24 | sa | above | 42 | 0.33168 | 0.47624 | 46.15333 | 64.70036 | -0.11679 [-0.19178, -0.04451] | 33.2% | 29.5% |
| flat-refit | 24 | sa | all | 106 | 0.35530 | 0.45067 | 51.76310 | 65.48423 | -0.07686 [-0.11280, -0.04077] | 37.9% | 18.4% |
| flat-refit | 24 | sa | below | 43 | 0.39318 | 0.53676 | 59.94780 | 80.67174 | -0.13352 [-0.21417, -0.06680] | 36.0% | 17.2% |
| flat-refit | 24 | sa | near | 21 | 0.31722 | 0.32157 | 43.65564 | 44.77873 | -0.00278 [-0.01369, 0.00794] | 45.8% | 3.0% |
| flat-refit | 24 | sa | above | 42 | 0.33168 | 0.40733 | 46.15333 | 56.18819 | -0.05590 [-0.10296, -0.01003] | 35.7% | 27.3% |
| flat-fixed | 12 | sa-decay | all | 106 | 0.22935 | 0.41591 | 35.92964 | 60.38851 | -0.12038 [-0.16285, -0.07971] | 30.3% | 30.5% |
| flat-fixed | 12 | sa-decay | below | 43 | 0.26847 | 0.49969 | 44.11208 | 74.89559 | -0.17761 [-0.26662, -0.10328] | 28.2% | 29.9% |
| flat-fixed | 12 | sa-decay | near | 21 | 0.20071 | 0.21078 | 29.29701 | 31.35065 | -0.00414 [-0.01363, 0.00485] | 44.8% | 13.3% |
| flat-fixed | 12 | sa-decay | above | 42 | 0.19702 | 0.39840 | 28.92612 | 54.49239 | -0.11991 [-0.17904, -0.06490] | 25.3% | 39.7% |
| flat-refit | 12 | sa-decay | all | 106 | 0.22935 | 0.29747 | 35.92964 | 46.19036 | -0.03589 [-0.05430, -0.01905] | 39.5% | 20.5% |
| flat-refit | 12 | sa-decay | below | 43 | 0.26847 | 0.36433 | 44.11208 | 58.82238 | -0.06066 [-0.10350, -0.02796] | 35.2% | 17.4% |
| flat-refit | 12 | sa-decay | near | 21 | 0.20071 | 0.20391 | 29.29701 | 30.15399 | -0.00129 [-0.00642, 0.00387] | 48.0% | 8.1% |
| flat-refit | 12 | sa-decay | above | 42 | 0.19702 | 0.25817 | 28.92612 | 37.25031 | -0.02784 [-0.04955, -0.00676] | 39.8% | 29.8% |
| flat-fixed | 18 | sa-decay | all | 106 | 0.30105 | 0.46902 | 45.05297 | 67.46466 | -0.12934 [-0.17904, -0.08095] | 33.5% | 25.8% |
| flat-fixed | 18 | sa-decay | below | 43 | 0.34509 | 0.57174 | 54.09907 | 84.55735 | -0.20780 [-0.31477, -0.11644] | 30.8% | 23.8% |
| flat-fixed | 18 | sa-decay | near | 21 | 0.27011 | 0.27837 | 37.74337 | 39.59332 | -0.00453 [-0.01798, 0.00847] | 44.8% | 7.5% |
| flat-fixed | 18 | sa-decay | above | 42 | 0.26521 | 0.42634 | 37.60425 | 58.16418 | -0.11143 [-0.17616, -0.05066] | 30.5% | 37.0% |
| flat-refit | 18 | sa-decay | all | 106 | 0.30105 | 0.38664 | 45.05297 | 57.62557 | -0.05886 [-0.08680, -0.03170] | 38.8% | 20.4% |
| flat-refit | 18 | sa-decay | below | 43 | 0.34509 | 0.47554 | 54.09907 | 73.29862 | -0.10705 [-0.17319, -0.05315] | 34.0% | 17.2% |
| flat-refit | 18 | sa-decay | near | 21 | 0.27011 | 0.27363 | 37.74337 | 38.71311 | -0.00192 [-0.01036, 0.00643] | 44.8% | 3.2% |
| flat-refit | 18 | sa-decay | above | 42 | 0.26521 | 0.32913 | 37.60425 | 46.16134 | -0.03799 [-0.06941, -0.00786] | 40.8% | 32.2% |
| flat-fixed | 24 | sa-decay | all | 106 | 0.35498 | 0.50969 | 51.59256 | 72.43728 | -0.13377 [-0.19018, -0.07998] | 35.4% | 20.6% |
| flat-fixed | 24 | sa-decay | below | 43 | 0.39019 | 0.60990 | 59.23188 | 88.90320 | -0.21973 [-0.34279, -0.11803] | 33.4% | 20.3% |
| flat-fixed | 24 | sa-decay | near | 21 | 0.31404 | 0.32154 | 43.44658 | 45.20661 | -0.00476 [-0.02065, 0.01083] | 44.0% | 4.2% |
| flat-fixed | 24 | sa-decay | above | 42 | 0.33593 | 0.47235 | 46.71302 | 64.25767 | -0.11026 [-0.18386, -0.03833] | 33.0% | 29.2% |
| flat-refit | 24 | sa-decay | all | 106 | 0.35498 | 0.44750 | 51.59256 | 64.93612 | -0.07424 [-0.10947, -0.03864] | 38.7% | 18.5% |
| flat-refit | 24 | sa-decay | below | 43 | 0.39019 | 0.53271 | 59.23188 | 79.78033 | -0.13153 [-0.21174, -0.06502] | 36.6% | 17.4% |
| flat-refit | 24 | sa-decay | near | 21 | 0.31404 | 0.31837 | 43.44658 | 44.60366 | -0.00274 [-0.01398, 0.00811] | 44.0% | 3.2% |
| flat-refit | 24 | sa-decay | above | 42 | 0.33593 | 0.40522 | 46.71302 | 55.95495 | -0.05135 [-0.09741, -0.00577] | 38.1% | 27.2% |

## Verification

```json
{
  "dates": 208,
  "dateSides": 416,
  "reconstructedEligibleRows": 18470,
  "maxArchivedForwardPriceDifference": 0,
  "interveningCouponLookups": 3034,
  "flatRefits": 7488,
  "actualPathCalibrationChecks": 7488,
  "maxArchivedFlatRateDifference": 0,
  "baselineObservationsPerFamily": 19332,
  "observations": 57996,
  "pairs": 54729,
  "summaries": 2376,
  "relationships": 1188,
  "bracketedYields": 2,
  "knownInflationViolations": 0,
  "duplicateObservationKeys": 0
}
```
