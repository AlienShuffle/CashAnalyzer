# Longer-end reference experiment: CPI carry

Range: 2015-01-01 through 2026-10-25. Primary dates: 208.
Training maturities are strictly beyond 12, 18, or 24 calendar months from original settlement; all tested maturities are within 12 months and strictly after historical maxREFCPI.
Each variant has its own longer-end-only reference. These are alternative parameterizations, not an observable natural curve. No short test bonds enter training; all predictions extrapolate.
Reference families remain Svensson: the three training cutoffs are a support sensitivity, not an independent model-family check.
Errors are observed minus predicted, on original settlement basis; yield is bp and price is clean price per 100.
For 2 extreme predictions the production Newton yield inversion was nonfinite; a bracketed inversion of the same cash flows was used and explicitly marked in observations.
Positive improvement = settlement squared error minus forward squared error. A negative carry-gap slope supports a larger forward advantage below trend.
The continuous carry gap is annualized percentage points, not a CPI forecast surprise.
Bonds are averaged within date/side, then date/sides within release episodes; episodes receive equal weight.
Slope intervals resample whole episodes 2,000 times, fixed seed. They ignore serial dependence, repeated-security dependence across episodes, and multiple testing.
The same retrospective dates generated this hypothesis; these results are exploratory, not out-of-sample validation.

## Primary 6–12-month results

| Training beyond months | CPI state | Variant | Episodes | Yield RMSE bp | Signed yield bp | Price RMSE / 100 |
|---:|---|---|---:|---:|---:|---:|
| 12 | all | settle/none | 106 | 170.708 | -31.221 | 1.0460 |
| 12 | below | settle/none | 43 | 205.934 | -83.039 | 1.2229 |
| 12 | near | settle/none | 21 | 115.936 | 3.146 | 0.7996 |
| 12 | above | settle/none | 42 | 152.996 | 4.646 | 0.9542 |
| 18 | all | settle/none | 106 | 362.223 | -99.470 | 2.2128 |
| 18 | below | settle/none | 43 | 474.997 | -145.917 | 2.8061 |
| 18 | near | settle/none | 21 | 305.104 | -95.745 | 2.1446 |
| 18 | above | settle/none | 42 | 231.515 | -53.779 | 1.4131 |
| 24 | all | settle/none | 106 | 771.664 | -254.905 | 4.5530 |
| 24 | below | settle/none | 43 | 966.151 | -418.314 | 5.4762 |
| 24 | near | settle/none | 21 | 756.952 | -371.632 | 4.6307 |
| 24 | above | settle/none | 42 | 510.567 | -29.242 | 3.3005 |
| 12 | all | settle/sa | 106 | 21.555 | -4.984 | 0.1477 |
| 12 | below | settle/sa | 43 | 20.216 | -1.984 | 0.1369 |
| 12 | near | settle/sa | 21 | 22.422 | -4.993 | 0.1514 |
| 12 | above | settle/sa | 42 | 22.423 | -8.052 | 0.1564 |
| 18 | all | settle/sa | 106 | 90.514 | -7.656 | 0.5584 |
| 18 | below | settle/sa | 43 | 132.653 | -14.781 | 0.8072 |
| 18 | near | settle/sa | 21 | 34.016 | -5.830 | 0.2369 |
| 18 | above | settle/sa | 42 | 45.636 | -1.275 | 0.3030 |
| 24 | all | settle/sa | 106 | 155.050 | -15.230 | 0.9160 |
| 24 | below | settle/sa | 43 | 225.489 | -32.264 | 1.2922 |
| 24 | near | settle/sa | 21 | 64.399 | -5.374 | 0.4423 |
| 24 | above | settle/sa | 42 | 80.895 | -2.717 | 0.5568 |
| 12 | all | settle/sa-decay | 106 | 42.986 | -6.440 | 0.2408 |
| 12 | below | settle/sa-decay | 43 | 61.999 | -8.607 | 0.3309 |
| 12 | near | settle/sa-decay | 21 | 24.858 | -5.513 | 0.1674 |
| 12 | above | settle/sa-decay | 42 | 20.473 | -4.685 | 0.1423 |
| 18 | all | settle/sa-decay | 106 | 106.247 | -14.332 | 0.6875 |
| 18 | below | settle/sa-decay | 43 | 132.244 | -13.926 | 0.8046 |
| 18 | near | settle/sa-decay | 21 | 89.071 | -24.513 | 0.7709 |
| 18 | above | settle/sa-decay | 42 | 81.351 | -9.658 | 0.4827 |
| 24 | all | settle/sa-decay | 106 | 252.910 | -51.709 | 1.5154 |
| 24 | below | settle/sa-decay | 43 | 343.302 | -89.488 | 2.0207 |
| 24 | near | settle/sa-decay | 21 | 91.534 | -19.939 | 0.7364 |
| 24 | above | settle/sa-decay | 42 | 191.259 | -28.916 | 1.1593 |
| 12 | all | forward/none | 106 | 198.683 | -40.749 | 1.2057 |
| 12 | below | forward/none | 43 | 229.364 | -95.241 | 1.3840 |
| 12 | near | forward/none | 21 | 116.897 | -2.806 | 0.8154 |
| 12 | above | forward/none | 42 | 197.317 | -3.930 | 1.1726 |
| 18 | all | forward/none | 106 | 441.517 | -87.567 | 2.6430 |
| 18 | below | forward/none | 43 | 603.956 | -121.304 | 3.5018 |
| 18 | near | forward/none | 21 | 359.236 | -88.969 | 2.5038 |
| 18 | above | forward/none | 42 | 232.401 | -52.325 | 1.3934 |
| 24 | all | forward/none | 106 | 829.854 | -231.502 | 4.9578 |
| 24 | below | forward/none | 43 | 1079.311 | -389.811 | 6.2517 |
| 24 | near | forward/none | 21 | 642.913 | -329.084 | 4.0194 |
| 24 | above | forward/none | 42 | 581.999 | -20.632 | 3.7338 |
| 12 | all | forward/sa | 106 | 57.501 | -3.992 | 0.3072 |
| 12 | below | forward/sa | 43 | 83.341 | -6.667 | 0.4231 |
| 12 | near | forward/sa | 21 | 23.604 | -5.682 | 0.1577 |
| 12 | above | forward/sa | 42 | 30.901 | -0.408 | 0.2062 |
| 18 | all | forward/sa | 106 | 128.657 | -9.959 | 0.8302 |
| 18 | below | forward/sa | 43 | 164.242 | -18.441 | 0.9710 |
| 18 | near | forward/sa | 21 | 98.209 | -24.761 | 0.8473 |
| 18 | above | forward/sa | 42 | 96.618 | 6.125 | 0.6442 |
| 24 | all | forward/sa | 106 | 254.208 | -36.011 | 1.5411 |
| 24 | below | forward/sa | 43 | 332.584 | -64.787 | 1.9323 |
| 24 | near | forward/sa | 21 | 284.005 | -54.350 | 1.8698 |
| 24 | above | forward/sa | 42 | 97.556 | 2.620 | 0.6505 |
| 12 | all | forward/sa-decay | 106 | 86.252 | -8.974 | 0.4508 |
| 12 | below | forward/sa-decay | 43 | 132.403 | -18.644 | 0.6800 |
| 12 | near | forward/sa-decay | 21 | 28.454 | -6.559 | 0.1889 |
| 12 | above | forward/sa-decay | 42 | 20.562 | -0.282 | 0.1469 |
| 18 | all | forward/sa-decay | 106 | 121.530 | -11.779 | 0.8163 |
| 18 | below | forward/sa-decay | 43 | 122.344 | -13.001 | 0.7384 |
| 18 | near | forward/sa-decay | 21 | 121.280 | -30.804 | 1.0478 |
| 18 | above | forward/sa-decay | 42 | 120.816 | -1.016 | 0.7580 |
| 24 | all | forward/sa-decay | 106 | 333.092 | -76.713 | 2.0149 |
| 24 | below | forward/sa-decay | 43 | 460.388 | -131.699 | 2.6923 |
| 24 | near | forward/sa-decay | 21 | 215.102 | -60.702 | 1.5760 |
| 24 | above | forward/sa-decay | 42 | 199.699 | -28.423 | 1.2584 |

## Continuous carry-gap relationship: 6–12 months

Slope units are improvement in squared bp or squared price-per-100 per one percentage point of carry gap. A negative slope supports the proposed direction; its magnitude is not a return.
Leave-one-episode-out ranges show whether deleting one episode changes the directional conclusion.

| Scope | Training beyond months | Adjustment | Metric | Episodes | Slope | 95% interval | Leave-one-out range |
|---|---:|---|---|---:|---:|---|---|
| primary | 12 | sa | yieldImprovement | 106 | 404.2902 | [-257.9909, 1719.6968] | [-91.2582, 498.5391] |
| primary | 12 | sa | priceImprovement | 106 | 0.0084 | [-0.0104, 0.0412] | [-0.0038, 0.0121] |
| primary | 18 | sa | yieldImprovement | 106 | -39.6572 | [-2151.7238, 2206.0311] | [-805.1171, 548.7926] |
| primary | 18 | sa | priceImprovement | 106 | -0.0099 | [-0.0979, 0.0669] | [-0.0332, 0.0175] |
| primary | 24 | sa | yieldImprovement | 106 | 3214.1379 | [23.2357, 8479.5325] | [2250.6834, 3743.2404] |
| primary | 24 | sa | priceImprovement | 106 | 0.1083 | [-0.0071, 0.3040] | [0.0739, 0.1276] |
| primary | 12 | sa-decay | yieldImprovement | 106 | 1037.2464 | [-13.6867, 3711.0911] | [12.7267, 1147.6843] |
| primary | 12 | sa-decay | priceImprovement | 106 | 0.0266 | [-0.0006, 0.0952] | [0.0004, 0.0295] |
| primary | 18 | sa-decay | yieldImprovement | 106 | -937.9959 | [-2740.7466, 93.7866] | [-1027.4403, -332.6216] |
| primary | 18 | sa-decay | priceImprovement | 106 | -0.0403 | [-0.1231, 0.0053] | [-0.0445, -0.0122] |
| primary | 24 | sa-decay | yieldImprovement | 106 | 3333.0772 | [-1678.2345, 10256.8726] | [1928.5541, 4413.2107] |
| primary | 24 | sa-decay | priceImprovement | 106 | 0.0924 | [-0.1017, 0.3414] | [0.0443, 0.1429] |
| ask | 12 | sa | yieldImprovement | 106 | -91.6064 | [-325.6641, 25.5947] | [-106.0206, 6.8028] |
| ask | 12 | sa | priceImprovement | 106 | -0.0038 | [-0.0129, 0.0012] | [-0.0045, 0.0000] |
| ask | 18 | sa | yieldImprovement | 106 | 513.6459 | [-660.1965, 2495.6856] | [-198.8654, 796.3650] |
| ask | 18 | sa | priceImprovement | 106 | 0.0169 | [-0.0255, 0.0821] | [-0.0051, 0.0283] |
| ask | 24 | sa | yieldImprovement | 106 | 2279.3151 | [42.7425, 6061.6860] | [1404.0011, 2640.2214] |
| ask | 24 | sa | priceImprovement | 106 | 0.0785 | [-0.0002, 0.2160] | [0.0469, 0.0916] |
| ask | 12 | sa-decay | yieldImprovement | 106 | 1446.8033 | [-20.1253, 5246.1483] | [-5.5326, 1601.0644] |
| ask | 12 | sa-decay | priceImprovement | 106 | 0.0386 | [-0.0008, 0.1403] | [-0.0002, 0.0428] |
| ask | 18 | sa-decay | yieldImprovement | 106 | -1297.1075 | [-4686.8762, 177.5629] | [-1409.5376, -65.7679] |
| ask | 18 | sa-decay | priceImprovement | 106 | -0.0436 | [-0.1600, 0.0112] | [-0.0470, -0.0004] |
| ask | 24 | sa-decay | yieldImprovement | 106 | 1954.1018 | [-1854.6011, 7611.1158] | [739.1180, 2672.8499] |
| ask | 24 | sa-decay | priceImprovement | 106 | 0.0642 | [-0.0697, 0.2573] | [0.0279, 0.0862] |
| bid | 12 | sa | yieldImprovement | 106 | 900.1868 | [-251.5687, 3534.4726] | [-90.9939, 1001.3089] |
| bid | 12 | sa | priceImprovement | 106 | 0.0206 | [-0.0103, 0.0858] | [-0.0039, 0.0241] |
| bid | 18 | sa | yieldImprovement | 106 | -592.9603 | [-4158.4922, 2092.9007] | [-1411.3688, 593.8584] |
| bid | 18 | sa | priceImprovement | 106 | -0.0368 | [-0.1947, 0.0633] | [-0.0614, 0.0186] |
| bid | 24 | sa | yieldImprovement | 106 | 4148.9607 | [-161.4890, 11169.7380] | [3097.3657, 4846.2594] |
| bid | 24 | sa | priceImprovement | 106 | 0.1381 | [-0.0230, 0.4012] | [0.0995, 0.1635] |
| bid | 12 | sa-decay | yieldImprovement | 106 | 627.6894 | [-12.8062, 2171.9930] | [30.9860, 694.3042] |
| bid | 12 | sa-decay | priceImprovement | 106 | 0.0147 | [-0.0006, 0.0501] | [0.0009, 0.0162] |
| bid | 18 | sa-decay | yieldImprovement | 106 | -578.8843 | [-4121.7264, 1868.0931] | [-1268.1146, 630.1406] |
| bid | 18 | sa-decay | priceImprovement | 106 | -0.0370 | [-0.1939, 0.0560] | [-0.0580, 0.0193] |
| bid | 24 | sa-decay | yieldImprovement | 106 | 4712.0526 | [-2330.2006, 13586.7973] | [2911.1579, 6456.1009] |
| bid | 24 | sa-decay | priceImprovement | 106 | 0.1207 | [-0.1512, 0.4377] | [0.0603, 0.2006] |
| excludeShutdownSensitive | 12 | sa | yieldImprovement | 100 | 426.2948 | [-304.8686, 1819.3882] | [-105.0116, 540.8827] |
| excludeShutdownSensitive | 12 | sa | priceImprovement | 100 | 0.0087 | [-0.0123, 0.0433] | [-0.0045, 0.0131] |
| excludeShutdownSensitive | 18 | sa | yieldImprovement | 100 | -227.2023 | [-2434.6196, 2364.0548] | [-1054.6780, 497.8209] |
| excludeShutdownSensitive | 18 | sa | priceImprovement | 100 | -0.0200 | [-0.1141, 0.0729] | [-0.0452, 0.0138] |
| excludeShutdownSensitive | 24 | sa | yieldImprovement | 100 | 2970.7908 | [-341.9987, 8525.8226] | [2085.0066, 3583.4243] |
| excludeShutdownSensitive | 24 | sa | priceImprovement | 100 | 0.0961 | [-0.0200, 0.3018] | [0.0645, 0.1182] |
| excludeShutdownSensitive | 12 | sa-decay | yieldImprovement | 100 | 1121.2753 | [-6.7269, 3873.0490] | [22.8692, 1256.4718] |
| excludeShutdownSensitive | 12 | sa-decay | priceImprovement | 100 | 0.0289 | [-0.0003, 0.0999] | [0.0007, 0.0324] |
| excludeShutdownSensitive | 18 | sa-decay | yieldImprovement | 100 | -1191.2275 | [-3309.3202, 28.3706] | [-1291.9131, -445.3983] |
| excludeShutdownSensitive | 18 | sa-decay | priceImprovement | 100 | -0.0523 | [-0.1494, 0.0019] | [-0.0566, -0.0176] |
| excludeShutdownSensitive | 24 | sa-decay | yieldImprovement | 100 | 2995.0492 | [-2106.9242, 10874.4782] | [1703.4064, 4292.2810] |
| excludeShutdownSensitive | 24 | sa-decay | priceImprovement | 100 | 0.0735 | [-0.1348, 0.3523] | [0.0292, 0.1341] |

## Scope and next experiments

The [summary](./carry-reference-summary.csv) includes every maturity bucket, regime, reference cutoff, and side/shutdown sensitivity.
The [paired observations](./carry-reference-pairs.csv) retain unknown-inflation days for subsequent conditional/horizon plots.
The [relationships](./carry-reference-relationships.csv) report descriptive univariate slopes; these do not control for maturity, season, or macro regime.
A nonnegative slope, reference-sensitive sign, or interval spanning zero weakens the simple proposed mechanism.
Next: an alternative curve-family reference; coherent trend-carry counterfactual; matched-bond/common-start release decomposition; prospective validation. These are not implemented by this first experiment.
See [the hypothesis and experiment design](../../CPI-HYPOTHESIS.md).
