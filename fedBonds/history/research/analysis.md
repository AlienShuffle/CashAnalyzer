# CPI-conditioned fedBonds curve study

Range: 2015-01-01 through 2026-10-25.
Verified dates: 210; primary dates: 208; scored release episodes: 106.
Blocked dates: 0.

Primary exclusions: March 2020–December 2022 and October–December 2025 CPI releases.
January–June 2026 CPI-filled trend risk is retained in the primary sample and removed in the separate sensitivity results.
Pre-release observations whose latest available CPI episode is excluded are also excluded from primary regime scores.

Errors below are maturity-grouped three-fold cross-validation RMSE in original settlement yield basis points.
Release episodes receive equal weight; quote sides are not independent events.
BEI errors are conditional on the fitted nominal curve, not independent traded BEI observations.
BEI scores omit bonds without a matched nominal residual; observation-level bonds/beiBonds columns disclose this coverage difference.
All-maturity yield scores can be dominated by very short held-out bonds outside the training maturity range. The 1–10-year comparison below is an important separate robustness check, not a replacement or deletion of these observations.

| Regime | Episodes | Dates | Variant | TIPS RMSE bp | Short TIPS RMSE bp | BEI RMSE bp |
|---|---:|---:|---|---:|---:|---:|
| below | 43 | 85 | settle/none | 83.820 | 177.631 | 77.548 |
| below | 43 | 85 | settle/sa | 12.943 | 27.080 | 13.411 |
| below | 43 | 85 | settle/sa-decay | 15.427 | 32.451 | 15.821 |
| below | 43 | 85 | forward/none | 62.049 | 132.000 | 60.346 |
| below | 43 | 85 | forward/sa | 10.242 | 21.442 | 10.860 |
| below | 43 | 85 | forward/sa-decay | 12.144 | 25.539 | 12.366 |
| near | 21 | 41 | settle/none | 88.550 | 189.319 | 78.491 |
| near | 21 | 41 | settle/sa | 22.802 | 44.772 | 19.958 |
| near | 21 | 41 | settle/sa-decay | 22.274 | 46.036 | 18.265 |
| near | 21 | 41 | forward/none | 55.458 | 118.229 | 52.243 |
| near | 21 | 41 | forward/sa | 12.901 | 24.962 | 12.037 |
| near | 21 | 41 | forward/sa-decay | 10.311 | 20.751 | 9.043 |
| above | 42 | 82 | settle/none | 110.792 | 232.530 | 84.145 |
| above | 42 | 82 | settle/sa | 45.970 | 96.584 | 11.127 |
| above | 42 | 82 | settle/sa-decay | 48.929 | 102.887 | 11.947 |
| above | 42 | 82 | forward/none | 73.067 | 158.419 | 72.722 |
| above | 42 | 82 | forward/sa | 25.030 | 54.534 | 25.368 |
| above | 42 | 82 | forward/sa-decay | 29.640 | 64.818 | 29.905 |
| all | 106 | 208 | settle/none | 96.266 | 203.284 | 80.408 |
| all | 106 | 208 | settle/sa | 31.754 | 66.263 | 14.175 |
| all | 106 | 208 | settle/sa-decay | 33.815 | 71.003 | 14.973 |
| all | 106 | 208 | forward/none | 65.472 | 140.647 | 64.136 |
| all | 106 | 208 | forward/sa | 17.994 | 38.578 | 18.208 |
| all | 106 | 208 | forward/sa-decay | 20.712 | 44.884 | 20.799 |

## Short-end maturity comparison

Buckets are measured from original settlement using calendar-month anniversaries (clamped at month end): (0,6], (3,12], and (6,12]. The 3–12-month bucket intentionally overlaps the others.
Every scored bond must mature strictly after its historical maxREFCPI date. The full eligible curve universe is used for fitting, not a separate Svensson fit on a handful of short bonds.
Empty date/side buckets remain missing, not zero. Each bucket and metric averages only episodes with available observations. BEI coverage can be smaller than TIPS coverage.
Price errors are per 100 of original settlement clean price, not inflation-adjusted dollars. Yield errors are bp. Small price errors near maturity can imply large annualized yield errors.
Unknown days measure maturity minus maxREFCPI, not maturity minus settlement. Bond observations include repeated dates and both sides, not independent securities or events.

| Regime | Bucket | Variant | Episodes / dates | Ask / bid dates | BEI episodes / dates | CV TIPS bp | CV BEI bp | CV price / 100 | Fit TIPS bp | Extrapolated / bond-side observations | Unknown days min–max |
|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| all | 0-6m | settle/none | 100 / 196 | 0 / 196 | 98 / 189 | 778.711 | 641.536 | 1.842 | 40.681 | 206 / 310 | 14–136 |
| all | 0-6m | settle/sa | 100 / 196 | 0 / 196 | 98 / 189 | 275.633 | 89.383 | 0.479 | 20.803 | 206 / 310 | 14–136 |
| all | 0-6m | settle/sa-decay | 100 / 196 | 0 / 196 | 98 / 189 | 295.256 | 99.794 | 0.522 | 22.729 | 206 / 310 | 14–136 |
| all | 0-6m | forward/none | 100 / 196 | 0 / 196 | 98 / 189 | 501.998 | 499.446 | 1.525 | 30.907 | 206 / 310 | 14–136 |
| all | 0-6m | forward/sa | 100 / 196 | 0 / 196 | 98 / 189 | 148.464 | 149.362 | 0.452 | 19.073 | 206 / 310 | 14–136 |
| all | 0-6m | forward/sa-decay | 100 / 196 | 0 / 196 | 98 / 189 | 169.877 | 170.701 | 0.528 | 18.256 | 206 / 310 | 14–136 |
| all | 3-12m | settle/none | 106 / 208 | 208 / 208 | 106 / 208 | 185.289 | 185.173 | 0.763 | 25.228 | 323 / 953 | 73–320 |
| all | 3-12m | settle/sa | 106 / 208 | 208 / 208 | 106 / 208 | 32.648 | 33.093 | 0.172 | 10.570 | 323 / 953 | 73–320 |
| all | 3-12m | settle/sa-decay | 106 / 208 | 208 / 208 | 106 / 208 | 33.163 | 33.662 | 0.169 | 10.976 | 323 / 953 | 73–320 |
| all | 3-12m | forward/none | 106 / 208 | 208 / 208 | 106 / 208 | 214.512 | 214.103 | 0.941 | 22.689 | 323 / 953 | 73–320 |
| all | 3-12m | forward/sa | 106 / 208 | 208 / 208 | 106 / 208 | 72.391 | 72.725 | 0.265 | 10.234 | 323 / 953 | 73–320 |
| all | 3-12m | forward/sa-decay | 106 / 208 | 208 / 208 | 106 / 208 | 84.837 | 85.024 | 0.317 | 10.346 | 323 / 953 | 73–320 |
| all | 6-12m | settle/none | 106 / 208 | 208 / 208 | 106 / 208 | 82.377 | 82.242 | 0.544 | 24.253 | 238 / 764 | 164–320 |
| all | 6-12m | settle/sa | 106 / 208 | 208 / 208 | 106 / 208 | 26.599 | 26.804 | 0.164 | 9.234 | 238 / 764 | 164–320 |
| all | 6-12m | settle/sa-decay | 106 / 208 | 208 / 208 | 106 / 208 | 23.897 | 24.072 | 0.157 | 9.499 | 238 / 764 | 164–320 |
| all | 6-12m | forward/none | 106 / 208 | 208 / 208 | 106 / 208 | 119.038 | 118.599 | 0.727 | 22.907 | 238 / 764 | 164–320 |
| all | 6-12m | forward/sa | 106 / 208 | 208 / 208 | 106 / 208 | 26.101 | 26.405 | 0.160 | 9.176 | 238 / 764 | 164–320 |
| all | 6-12m | forward/sa-decay | 106 / 208 | 208 / 208 | 106 / 208 | 33.079 | 32.964 | 0.198 | 9.441 | 238 / 764 | 164–320 |
| below | 0-6m | settle/none | 43 / 85 | 0 / 85 | 43 / 85 | 595.161 | 559.924 | 1.562 | 36.229 | 89 / 141 | 14–136 |
| below | 0-6m | settle/sa | 43 / 85 | 0 / 85 | 43 / 85 | 76.170 | 76.467 | 0.180 | 19.661 | 89 / 141 | 14–136 |
| below | 0-6m | settle/sa-decay | 43 / 85 | 0 / 85 | 43 / 85 | 99.379 | 99.679 | 0.238 | 20.004 | 89 / 141 | 14–136 |
| below | 0-6m | forward/none | 43 / 85 | 0 / 85 | 43 / 85 | 459.831 | 449.862 | 1.385 | 24.315 | 89 / 141 | 14–136 |
| below | 0-6m | forward/sa | 43 / 85 | 0 / 85 | 43 / 85 | 55.233 | 55.858 | 0.148 | 17.813 | 89 / 141 | 14–136 |
| below | 0-6m | forward/sa-decay | 43 / 85 | 0 / 85 | 43 / 85 | 76.430 | 74.968 | 0.205 | 15.409 | 89 / 141 | 14–136 |
| below | 3-12m | settle/none | 43 / 85 | 85 / 85 | 43 / 85 | 189.303 | 189.320 | 0.768 | 27.210 | 128 / 369 | 73–320 |
| below | 3-12m | settle/sa | 43 / 85 | 85 / 85 | 43 / 85 | 42.540 | 42.695 | 0.224 | 10.350 | 128 / 369 | 73–320 |
| below | 3-12m | settle/sa-decay | 43 / 85 | 85 / 85 | 43 / 85 | 42.270 | 42.475 | 0.215 | 11.298 | 128 / 369 | 73–320 |
| below | 3-12m | forward/none | 43 / 85 | 85 / 85 | 43 / 85 | 176.955 | 176.884 | 0.756 | 23.549 | 128 / 369 | 73–320 |
| below | 3-12m | forward/sa | 43 / 85 | 85 / 85 | 43 / 85 | 39.965 | 40.377 | 0.212 | 10.291 | 128 / 369 | 73–320 |
| below | 3-12m | forward/sa-decay | 43 / 85 | 85 / 85 | 43 / 85 | 40.709 | 41.109 | 0.217 | 10.819 | 128 / 369 | 73–320 |
| below | 6-12m | settle/none | 43 / 85 | 85 / 85 | 43 / 85 | 73.547 | 74.106 | 0.518 | 26.634 | 85 / 274 | 164–320 |
| below | 6-12m | settle/sa | 43 / 85 | 85 / 85 | 43 / 85 | 36.688 | 36.815 | 0.216 | 9.055 | 85 / 274 | 164–320 |
| below | 6-12m | settle/sa-decay | 43 / 85 | 85 / 85 | 43 / 85 | 31.570 | 31.679 | 0.201 | 9.914 | 85 / 274 | 164–320 |
| below | 6-12m | forward/none | 43 / 85 | 85 / 85 | 43 / 85 | 78.725 | 79.205 | 0.550 | 25.216 | 85 / 274 | 164–320 |
| below | 6-12m | forward/sa | 43 / 85 | 85 / 85 | 43 / 85 | 35.624 | 35.861 | 0.207 | 9.356 | 85 / 274 | 164–320 |
| below | 6-12m | forward/sa-decay | 43 / 85 | 85 / 85 | 43 / 85 | 32.255 | 32.402 | 0.207 | 10.412 | 85 / 274 | 164–320 |
| near | 0-6m | settle/none | 20 / 39 | 0 / 39 | 19 / 37 | 653.089 | 611.082 | 1.394 | 46.733 | 43 / 68 | 14–136 |
| near | 0-6m | settle/sa | 20 / 39 | 0 / 39 | 19 / 37 | 142.103 | 123.298 | 0.213 | 18.400 | 43 / 68 | 14–136 |
| near | 0-6m | settle/sa-decay | 20 / 39 | 0 / 39 | 19 / 37 | 142.595 | 115.981 | 0.201 | 21.973 | 43 / 68 | 14–136 |
| near | 0-6m | forward/none | 20 / 39 | 0 / 39 | 19 / 37 | 401.125 | 392.749 | 1.070 | 30.048 | 43 / 68 | 14–136 |
| near | 0-6m | forward/sa | 20 / 39 | 0 / 39 | 19 / 37 | 77.420 | 68.846 | 0.133 | 17.339 | 43 / 68 | 14–136 |
| near | 0-6m | forward/sa-decay | 20 / 39 | 0 / 39 | 19 / 37 | 61.814 | 48.016 | 0.117 | 17.705 | 43 / 68 | 14–136 |
| near | 3-12m | settle/none | 21 / 41 | 41 / 41 | 21 / 41 | 114.456 | 114.357 | 0.614 | 26.370 | 63 / 199 | 75–318 |
| near | 3-12m | settle/sa | 21 / 41 | 41 / 41 | 21 / 41 | 20.946 | 21.738 | 0.123 | 9.540 | 63 / 199 | 75–318 |
| near | 3-12m | settle/sa-decay | 21 / 41 | 41 / 41 | 21 / 41 | 20.396 | 21.180 | 0.120 | 9.937 | 63 / 199 | 75–318 |
| near | 3-12m | forward/none | 21 / 41 | 41 / 41 | 21 / 41 | 137.144 | 137.065 | 0.770 | 23.476 | 63 / 199 | 75–318 |
| near | 3-12m | forward/sa | 21 / 41 | 41 / 41 | 21 / 41 | 20.866 | 21.495 | 0.118 | 9.846 | 63 / 199 | 75–318 |
| near | 3-12m | forward/sa-decay | 21 / 41 | 41 / 41 | 21 / 41 | 20.490 | 21.131 | 0.117 | 9.989 | 63 / 199 | 75–318 |
| near | 6-12m | settle/none | 21 / 41 | 41 / 41 | 21 / 41 | 77.102 | 77.242 | 0.519 | 25.438 | 51 / 162 | 167–318 |
| near | 6-12m | settle/sa | 21 / 41 | 41 / 41 | 21 / 41 | 17.418 | 17.545 | 0.119 | 8.168 | 51 / 162 | 167–318 |
| near | 6-12m | settle/sa-decay | 21 / 41 | 41 / 41 | 21 / 41 | 17.206 | 17.244 | 0.118 | 8.111 | 51 / 162 | 167–318 |
| near | 6-12m | forward/none | 21 / 41 | 41 / 41 | 21 / 41 | 110.133 | 110.236 | 0.705 | 23.276 | 51 / 162 | 167–318 |
| near | 6-12m | forward/sa | 21 / 41 | 41 / 41 | 21 / 41 | 16.512 | 16.604 | 0.113 | 8.519 | 51 / 162 | 167–318 |
| near | 6-12m | forward/sa-decay | 21 / 41 | 41 / 41 | 21 / 41 | 16.408 | 16.420 | 0.113 | 8.780 | 51 / 162 | 167–318 |
| above | 0-6m | settle/none | 37 / 72 | 0 / 72 | 36 / 67 | 998.340 | 740.824 | 2.299 | 42.036 | 74 / 101 | 14–136 |
| above | 0-6m | settle/sa | 37 / 72 | 0 / 72 | 36 / 67 | 433.216 | 82.103 | 0.747 | 23.181 | 74 / 101 | 14–136 |
| above | 0-6m | settle/sa-decay | 37 / 72 | 0 / 72 | 36 / 67 | 461.674 | 90.236 | 0.805 | 25.889 | 74 / 101 | 14–136 |
| above | 0-6m | forward/none | 37 / 72 | 0 / 72 | 36 / 67 | 590.237 | 596.583 | 1.855 | 37.505 | 74 / 101 | 14–136 |
| above | 0-6m | forward/sa | 37 / 72 | 0 / 72 | 36 / 67 | 229.753 | 233.455 | 0.720 | 21.259 | 74 / 101 | 14–136 |
| above | 0-6m | forward/sa-decay | 37 / 72 | 0 / 72 | 36 / 67 | 262.946 | 267.194 | 0.835 | 21.339 | 74 / 101 | 14–136 |
| above | 3-12m | settle/none | 42 / 82 | 82 / 82 | 42 / 82 | 208.347 | 208.099 | 0.823 | 22.374 | 132 / 385 | 75–319 |
| above | 3-12m | settle/sa | 42 / 82 | 82 / 82 | 42 / 82 | 24.858 | 25.720 | 0.126 | 11.260 | 132 / 385 | 75–319 |
| above | 3-12m | settle/sa-decay | 42 / 82 | 82 / 82 | 42 / 82 | 27.173 | 28.079 | 0.133 | 11.136 | 132 / 385 | 75–319 |
| above | 3-12m | forward/none | 42 / 82 | 82 / 82 | 42 / 82 | 273.261 | 272.516 | 1.164 | 21.351 | 132 / 385 | 75–319 |
| above | 3-12m | forward/sa | 42 / 82 | 82 / 82 | 42 / 82 | 106.643 | 106.995 | 0.352 | 10.366 | 132 / 385 | 75–319 |
| above | 3-12m | forward/sa-decay | 42 / 82 | 82 / 82 | 42 / 82 | 127.507 | 127.638 | 0.445 | 10.021 | 132 / 385 | 75–319 |
| above | 6-12m | settle/none | 42 / 82 | 82 / 82 | 42 / 82 | 92.824 | 92.005 | 0.581 | 20.849 | 102 / 328 | 165–319 |
| above | 6-12m | settle/sa | 42 / 82 | 82 / 82 | 42 / 82 | 15.994 | 16.482 | 0.114 | 9.893 | 102 / 328 | 165–319 |
| above | 6-12m | settle/sa-decay | 42 / 82 | 82 / 82 | 42 / 82 | 16.519 | 16.920 | 0.119 | 9.705 | 102 / 328 | 165–319 |
| above | 6-12m | forward/none | 42 / 82 | 82 / 82 | 42 / 82 | 152.817 | 151.659 | 0.882 | 20.060 | 102 / 328 | 165–319 |
| above | 6-12m | forward/sa | 42 / 82 | 82 / 82 | 42 / 82 | 16.845 | 17.471 | 0.119 | 9.307 | 102 / 328 | 165–319 |
| above | 6-12m | forward/sa-decay | 42 / 82 | 82 / 82 | 42 / 82 | 39.521 | 39.150 | 0.221 | 8.685 | 102 / 328 | 165–319 |

**0-6m coverage limitation:** 0 ask dates and 196 bid dates. An absent side is missing, not a zero-error result; this bucket cannot validate performance on both quote sides.

### Short-end leaders and runner-up uncertainty

Differences favor the leader when negative. These are exploratory paired episode bootstrap intervals; overlapping buckets, repeated securities, and adjacent months are not independent replications.
The price interval is in price per 100, not bp. A descriptive yield winner need not be the price winner.

| Regime | Bucket | Score | Leader | Runner-up | Difference | 95% interval | Episodes |
|---|---|---|---|---|---:|---:|---:|
| all | 0-6m | TIPS bp | forward/sa | forward/sa-decay | -21.413 | [-37.914, 2.377] | 100 |
| all | 0-6m | BEI bp | settle/sa | settle/sa-decay | -10.411 | [-28.341, 10.406] | 98 |
| all | 0-6m | Price / 100 | forward/sa | settle/sa | -0.027 | [-0.575, 0.533] | 100 |
| all | 3-12m | TIPS bp | settle/sa | settle/sa-decay | -0.516 | [-5.683, 4.864] | 106 |
| all | 3-12m | BEI bp | settle/sa | settle/sa-decay | -0.569 | [-5.712, 4.773] | 106 |
| all | 3-12m | Price / 100 | settle/sa-decay | settle/sa | -0.002 | [-0.026, 0.018] | 106 |
| all | 6-12m | TIPS bp | settle/sa-decay | forward/sa | -2.204 | [-6.587, 2.322] | 106 |
| all | 6-12m | BEI bp | settle/sa-decay | forward/sa | -2.334 | [-6.709, 2.182] | 106 |
| all | 6-12m | Price / 100 | settle/sa-decay | forward/sa | -0.003 | [-0.026, 0.018] | 106 |
| below | 0-6m | TIPS bp | forward/sa | settle/sa | -20.938 | [-35.343, -4.994] | 43 |
| below | 0-6m | BEI bp | forward/sa | forward/sa-decay | -19.110 | [-32.299, -4.862] | 43 |
| below | 0-6m | Price / 100 | forward/sa | settle/sa | -0.032 | [-0.065, 0.003] | 43 |
| below | 3-12m | TIPS bp | forward/sa | forward/sa-decay | -0.744 | [-12.173, 9.057] | 43 |
| below | 3-12m | BEI bp | forward/sa | forward/sa-decay | -0.732 | [-12.075, 9.043] | 43 |
| below | 3-12m | Price / 100 | forward/sa | settle/sa-decay | -0.003 | [-0.050, 0.042] | 43 |
| below | 6-12m | TIPS bp | settle/sa-decay | forward/sa-decay | -0.685 | [-4.351, 1.452] | 43 |
| below | 6-12m | BEI bp | settle/sa-decay | forward/sa-decay | -0.723 | [-4.419, 1.410] | 43 |
| below | 6-12m | Price / 100 | settle/sa-decay | forward/sa-decay | -0.006 | [-0.031, 0.011] | 43 |
| near | 0-6m | TIPS bp | forward/sa-decay | forward/sa | -15.606 | [-46.467, 9.253] | 20 |
| near | 0-6m | BEI bp | forward/sa-decay | forward/sa | -20.831 | [-50.262, 7.476] | 19 |
| near | 0-6m | Price / 100 | forward/sa-decay | forward/sa | -0.016 | [-0.049, 0.011] | 20 |
| near | 3-12m | TIPS bp | settle/sa-decay | forward/sa-decay | -0.095 | [-2.900, 2.173] | 21 |
| near | 3-12m | BEI bp | forward/sa-decay | settle/sa-decay | -0.049 | [-2.324, 2.721] | 21 |
| near | 3-12m | Price / 100 | forward/sa-decay | forward/sa | -0.002 | [-0.015, 0.010] | 21 |
| near | 6-12m | TIPS bp | forward/sa-decay | forward/sa | -0.104 | [-2.246, 1.770] | 21 |
| near | 6-12m | BEI bp | forward/sa-decay | forward/sa | -0.183 | [-2.352, 1.739] | 21 |
| near | 6-12m | Price / 100 | forward/sa | forward/sa-decay | -0.000 | [-0.012, 0.013] | 21 |
| above | 0-6m | TIPS bp | forward/sa | forward/sa-decay | -33.193 | [-58.549, 1.356] | 37 |
| above | 0-6m | BEI bp | settle/sa | settle/sa-decay | -8.133 | [-15.845, -0.073] | 36 |
| above | 0-6m | Price / 100 | forward/sa | settle/sa | -0.027 | [-1.004, 0.968] | 37 |
| above | 3-12m | TIPS bp | settle/sa | settle/sa-decay | -2.316 | [-4.229, -0.187] | 42 |
| above | 3-12m | BEI bp | settle/sa | settle/sa-decay | -2.360 | [-4.182, -0.313] | 42 |
| above | 3-12m | Price / 100 | settle/sa | settle/sa-decay | -0.008 | [-0.014, -0.001] | 42 |
| above | 6-12m | TIPS bp | settle/sa | settle/sa-decay | -0.525 | [-1.302, 0.270] | 42 |
| above | 6-12m | BEI bp | settle/sa | settle/sa-decay | -0.438 | [-1.244, 0.356] | 42 |
| above | 6-12m | Price / 100 | settle/sa | settle/sa-decay | -0.005 | [-0.010, 0.000] | 42 |

Full coverage, fit-price errors, mean unknown days, and interpolation-only diagnostics are in [the short-end table](./cpi-curve-short-end.csv).
Interpolation-only errors are a selected diagnostic subset, not a replacement for the full holdout score; the shortest bond will often require extrapolation when held out.
A large fit-versus-holdout gap warns against treating an attractive fitted short-end shape as predictive accuracy.


## One- to ten-year maturity comparison

The holdout fits still train on the same full bond universe; this table scores only original settlement maturities from one through ten years.
This separates better-supported tenors from near-maturity yield sensitivity and extrapolation.

| Regime | Variant | TIPS RMSE bp | BEI proxy RMSE bp | TIPS above 3 years RMSE bp |
|---|---|---:|---:|---:|
| below | settle/none | 11.487 | 11.620 | 4.876 |
| below | settle/sa | 3.858 | 4.390 | 2.596 |
| below | settle/sa-decay | 4.195 | 4.644 | 2.754 |
| below | forward/none | 11.538 | 11.677 | 4.895 |
| below | forward/sa | 3.862 | 4.421 | 2.601 |
| below | forward/sa-decay | 4.193 | 4.669 | 2.770 |
| near | settle/none | 10.559 | 11.022 | 4.689 |
| near | settle/sa | 3.808 | 4.693 | 2.690 |
| near | settle/sa-decay | 3.985 | 4.851 | 2.789 |
| near | forward/none | 10.522 | 11.027 | 4.697 |
| near | forward/sa | 3.827 | 4.699 | 2.686 |
| near | forward/sa-decay | 3.999 | 4.844 | 2.774 |
| above | settle/none | 11.397 | 11.875 | 4.871 |
| above | settle/sa | 4.141 | 4.689 | 2.721 |
| above | settle/sa-decay | 4.262 | 4.840 | 2.819 |
| above | forward/none | 11.468 | 11.960 | 4.876 |
| above | forward/sa | 4.030 | 4.676 | 2.748 |
| above | forward/sa-decay | 4.167 | 4.819 | 2.848 |
| all | settle/none | 11.273 | 11.607 | 4.837 |
| all | settle/sa | 3.963 | 4.571 | 2.665 |
| all | settle/sa-decay | 4.181 | 4.764 | 2.787 |
| all | forward/none | 11.316 | 11.666 | 4.849 |
| all | forward/sa | 3.923 | 4.579 | 2.677 |
| all | forward/sa-decay | 4.145 | 4.764 | 2.802 |

## Leaders and uncertainty

Negative differences favor the descriptive leader. Intervals resample whole release episodes; they are exploratory and not adjusted for selecting the best of six curves.
Monthly episodes can remain serially correlated, so the intervals and sample-size estimates should not be treated as definitive significance tests.

| Regime | Score | Leader | Runner-up | Difference bp | 95% interval bp | Episodes |
|---|---|---|---|---:|---:|---:|
| below | TIPS | forward/sa | forward/sa-decay | -1.902 | [-3.850, 0.173] | 43 |
| below | BEI proxy | forward/sa | forward/sa-decay | -1.506 | [-3.219, 0.293] | 43 |
| below | 1–10y TIPS | settle/sa | forward/sa | -0.003 | [-0.051, 0.048] | 43 |
| below | 1–10y BEI proxy | settle/sa | forward/sa | -0.031 | [-0.093, 0.035] | 43 |
| near | TIPS | forward/sa-decay | forward/sa | -2.590 | [-7.651, 1.380] | 21 |
| near | BEI proxy | forward/sa-decay | forward/sa | -2.993 | [-7.506, 0.883] | 21 |
| near | 1–10y TIPS | settle/sa | forward/sa | -0.019 | [-0.077, 0.034] | 21 |
| near | 1–10y BEI proxy | settle/sa | forward/sa | -0.007 | [-0.068, 0.054] | 21 |
| above | TIPS | forward/sa | forward/sa-decay | -4.610 | [-8.126, -0.014] | 42 |
| above | BEI proxy | settle/sa | settle/sa-decay | -0.819 | [-1.994, 0.276] | 42 |
| above | 1–10y TIPS | forward/sa | settle/sa | -0.111 | [-0.200, -0.037] | 42 |
| above | 1–10y BEI proxy | forward/sa | settle/sa | -0.013 | [-0.105, 0.089] | 42 |
| all | TIPS | forward/sa | forward/sa-decay | -2.719 | [-4.848, 0.417] | 106 |
| all | BEI proxy | settle/sa | settle/sa-decay | -0.797 | [-3.711, 2.489] | 106 |
| all | 1–10y TIPS | forward/sa | settle/sa | -0.041 | [-0.086, -0.001] | 106 |
| all | 1–10y BEI proxy | settle/sa | forward/sa | -0.008 | [-0.057, 0.040] | 106 |

## Release-pair shape changes

Complete primary -5/+5 pairs: 103 of 105 selected releases.
A pair can be absent because its pre-release snapshot is governed by an excluded prior episode; taking more quotes on that same date would not repair the policy exclusion.
The counts below average the two quote sides within each release. A flip requires slopes on opposite sides of +/-2 bp.
Fixed-start slopes compare one- and five-year rates starting at the same post-release maxREFCPI date, avoiding a moving-forward-date comparison.

| Variant | BEI down-to-up | BEI up-to-down | Fixed-start BEI down-to-up | Fixed-start BEI up-to-down | Fixed-start real down-to-up |
|---|---:|---:|---:|---:|---:|
| settle/none | 4.5 | 4 | 7 | 7.5 | 6.5 |
| settle/sa | 3 | 6.5 | 3 | 7.5 | 1.5 |
| settle/sa-decay | 4 | 6.5 | 3 | 6 | 2.5 |
| forward/none | 11 | 7 | 15.5 | 7 | 8.5 |
| forward/sa | 7 | 5 | 5.5 | 4.5 | 2.5 |
| forward/sa-decay | 8 | 4 | 6 | 3.5 | 3 |

## Coverage and additional observations

Missing suggested -5/+5 observations: 0.
Planning estimates below target a 1 bp difference between each regime's TIPS leader and runner-up, at 80% power and a two-sided 5% threshold.
They use observed episode-to-episode dispersion, ignore serial dependence and model selection, and are rough planning numbers rather than a guarantee.

| Regime | TIPS score | Scored release episodes | Estimated total episodes for 1 bp | Estimated additional episodes |
|---|---|---:|---:|---:|
| below | All maturities | 43 | 139 | 96 |
| below | 1–10 years | 43 | 1 | 0 |
| near | All maturities | 21 | 267 | 246 |
| near | 1–10 years | 21 | 1 | 0 |
| above | All maturities | 42 | 498 | 456 |
| above | 1–10 years | 42 | 1 | 0 |

Large all-maturity sample requirements can reflect unstable short-end extrapolation; collecting more dates alone does not fix that modeling limitation.

Lowest error is descriptive, not proof of a universal winner. Full pairwise intervals and sensitivity results are in [the JSON results](./cpi-curve-analysis.json).
Real-yield and BEI curves are not theoretically required to slope upward.
Findings are conditional on excluding the pandemic/rebound and shutdown episodes; they do not establish performance in those regimes.
This is a current-vintage historical-price replay, not a point-in-time backtest or realized-return study.
The [observation CSV](./cpi-curve-observations.csv), [release pairs](./cpi-curve-release-pairs.csv), [sampling plan](./cpi-curve-sampling-plan.csv), execution statuses, and source hashes accompany this report.
