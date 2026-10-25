# Longer-end reference experiment: CPI carry (flat-nearest3)

Range: 2015-01-01 through 2026-10-25. Primary dates: 208.
Training maturities are strictly beyond 12, 18, or 24 calendar months from original settlement; all tested maturities are within 12 months and strictly after historical maxREFCPI.
Each variant has its own longer-end-only reference. These are alternative parameterizations, not an observable natural curve. No short test bonds enter training; all predictions extrapolate.
Independent benchmark: one continuously compounded ACT/365 real rate calibrated so the sum of dirty present values equals the sum of observed dirty prices for the three nearest eligible training bonds, with equal par. This is aggregate-price matching, not least squares. No slope or monotonic yield constraint is imposed. Selection is fixed by maturity, then CUSIP; no short error is used for selection.
Errors are observed minus predicted, on original settlement basis; yield is bp and price is clean price per 100.
For 0 extreme predictions the production Newton yield inversion was nonfinite; a bracketed inversion of the same cash flows was used and explicitly marked in observations.
Positive improvement = settlement squared error minus forward squared error. A negative carry-gap slope supports a larger forward advantage below trend.
The continuous carry gap is annualized percentage points, not a CPI forecast surprise.
Bonds are averaged within date/side, then date/sides within release episodes; episodes receive equal weight.
Slope intervals resample whole episodes 2,000 times, fixed seed. They ignore serial dependence, repeated-security dependence across episodes, and multiple testing.
The same retrospective dates generated this hypothesis; these results are exploratory, not out-of-sample validation.

## Primary 6–12-month results

| Training beyond months | CPI state | Variant | Episodes | Yield RMSE bp | Signed yield bp | Price RMSE / 100 |
|---:|---|---|---:|---:|---:|---:|
| 12 | all | settle/none | 106 | 52.528 | 6.947 | 0.3409 |
| 12 | below | settle/none | 43 | 58.076 | 10.099 | 0.3648 |
| 12 | near | settle/none | 21 | 50.781 | 11.857 | 0.3297 |
| 12 | above | settle/none | 42 | 47.130 | 1.265 | 0.3204 |
| 18 | all | settle/none | 106 | 61.952 | 9.521 | 0.4093 |
| 18 | below | settle/none | 43 | 70.421 | 18.394 | 0.4523 |
| 18 | near | settle/none | 21 | 57.699 | 16.190 | 0.3847 |
| 18 | above | settle/none | 42 | 54.265 | -2.898 | 0.3732 |
| 24 | all | settle/none | 106 | 69.869 | 11.207 | 0.4710 |
| 24 | below | settle/none | 43 | 75.890 | 20.184 | 0.4977 |
| 24 | near | settle/none | 21 | 65.181 | 18.236 | 0.4347 |
| 24 | above | settle/none | 42 | 65.572 | -1.497 | 0.4603 |
| 12 | all | settle/sa | 106 | 39.626 | 3.262 | 0.2516 |
| 12 | below | settle/sa | 43 | 49.867 | 13.526 | 0.3035 |
| 12 | near | settle/sa | 21 | 28.057 | 5.573 | 0.1902 |
| 12 | above | settle/sa | 42 | 31.990 | -8.402 | 0.2177 |
| 18 | all | settle/sa | 106 | 50.098 | 6.935 | 0.3327 |
| 18 | below | settle/sa | 43 | 62.324 | 19.436 | 0.3980 |
| 18 | near | settle/sa | 21 | 36.912 | 9.841 | 0.2613 |
| 18 | above | settle/sa | 42 | 40.942 | -7.318 | 0.2883 |
| 24 | all | settle/sa | 106 | 57.486 | 7.423 | 0.3926 |
| 24 | below | settle/sa | 43 | 68.635 | 20.833 | 0.4512 |
| 24 | near | settle/sa | 21 | 43.066 | 10.136 | 0.3079 |
| 24 | above | settle/sa | 42 | 50.893 | -7.662 | 0.3650 |
| 12 | all | settle/sa-decay | 106 | 39.324 | 3.407 | 0.2504 |
| 12 | below | settle/sa-decay | 43 | 49.230 | 12.665 | 0.3012 |
| 12 | near | settle/sa-decay | 21 | 28.396 | 5.637 | 0.1909 |
| 12 | above | settle/sa-decay | 42 | 31.912 | -7.187 | 0.2171 |
| 18 | all | settle/sa-decay | 106 | 49.911 | 6.984 | 0.3322 |
| 18 | below | settle/sa-decay | 43 | 61.884 | 18.668 | 0.3966 |
| 18 | near | settle/sa-decay | 21 | 37.332 | 9.823 | 0.2631 |
| 18 | above | settle/sa-decay | 42 | 40.858 | -6.397 | 0.2879 |
| 24 | all | settle/sa-decay | 106 | 57.334 | 7.595 | 0.3922 |
| 24 | below | settle/sa-decay | 43 | 68.078 | 20.026 | 0.4490 |
| 24 | near | settle/sa-decay | 21 | 43.337 | 10.226 | 0.3076 |
| 24 | above | settle/sa-decay | 42 | 51.109 | -6.447 | 0.3668 |
| 12 | all | forward/none | 106 | 53.277 | 11.217 | 0.3473 |
| 12 | below | forward/none | 43 | 54.842 | -1.767 | 0.3427 |
| 12 | near | forward/none | 21 | 52.159 | 15.240 | 0.3413 |
| 12 | above | forward/none | 42 | 52.195 | 22.498 | 0.3549 |
| 18 | all | forward/none | 106 | 59.935 | 14.125 | 0.3959 |
| 18 | below | forward/none | 43 | 63.311 | 2.090 | 0.4051 |
| 18 | near | forward/none | 21 | 58.679 | 19.887 | 0.3934 |
| 18 | above | forward/none | 42 | 56.927 | 23.566 | 0.3876 |
| 24 | all | forward/none | 106 | 67.735 | 16.589 | 0.4564 |
| 24 | below | forward/none | 43 | 67.632 | 2.085 | 0.4410 |
| 24 | near | forward/none | 21 | 65.499 | 22.121 | 0.4401 |
| 24 | above | forward/none | 42 | 68.928 | 28.672 | 0.4793 |
| 12 | all | forward/sa | 106 | 36.251 | 7.138 | 0.2305 |
| 12 | below | forward/sa | 43 | 44.902 | 11.745 | 0.2716 |
| 12 | near | forward/sa | 21 | 29.489 | 4.756 | 0.2035 |
| 12 | above | forward/sa | 42 | 28.595 | 3.613 | 0.1946 |
| 18 | all | forward/sa | 106 | 45.290 | 11.383 | 0.3017 |
| 18 | below | forward/sa | 43 | 54.717 | 16.482 | 0.3473 |
| 18 | near | forward/sa | 21 | 37.694 | 8.648 | 0.2708 |
| 18 | above | forward/sa | 42 | 37.433 | 7.529 | 0.2638 |
| 24 | all | forward/sa | 106 | 51.763 | 12.367 | 0.3553 |
| 24 | below | forward/sa | 43 | 59.948 | 17.309 | 0.3932 |
| 24 | near | forward/sa | 21 | 43.656 | 8.432 | 0.3172 |
| 24 | above | forward/sa | 42 | 46.153 | 9.276 | 0.3317 |
| 12 | all | forward/sa-decay | 106 | 35.930 | 7.308 | 0.2293 |
| 12 | below | forward/sa-decay | 43 | 44.112 | 10.924 | 0.2685 |
| 12 | near | forward/sa-decay | 21 | 29.297 | 4.848 | 0.2007 |
| 12 | above | forward/sa-decay | 42 | 28.926 | 4.837 | 0.1970 |
| 18 | all | forward/sa-decay | 106 | 45.053 | 11.470 | 0.3011 |
| 18 | below | forward/sa-decay | 43 | 54.099 | 15.741 | 0.3451 |
| 18 | near | forward/sa-decay | 21 | 37.743 | 8.676 | 0.2701 |
| 18 | above | forward/sa-decay | 42 | 37.604 | 8.494 | 0.2652 |
| 24 | all | forward/sa-decay | 106 | 51.593 | 12.567 | 0.3550 |
| 24 | below | forward/sa-decay | 43 | 59.232 | 16.540 | 0.3902 |
| 24 | near | forward/sa-decay | 21 | 43.447 | 8.550 | 0.3140 |
| 24 | above | forward/sa-decay | 42 | 46.713 | 10.508 | 0.3359 |

## Continuous carry-gap relationship: 6–12 months

Slope units are improvement in squared bp or squared price-per-100 per one percentage point of carry gap. A negative slope supports the proposed direction; its magnitude is not a return.
Leave-one-episode-out ranges show whether deleting one episode changes the directional conclusion.

| Reference | Scope | Training beyond months | Adjustment | Metric | Episodes | Slope | 95% interval | Leave-one-out range |
|---|---|---:|---|---|---:|---:|---|---|
| flat-nearest3 | primary | 12 | sa | yieldImprovement | 106 | -21.6964 | [-134.0497, 75.5002] | [-51.0332, 17.4261] |
| flat-nearest3 | primary | 12 | sa | priceImprovement | 106 | -0.0003 | [-0.0043, 0.0038] | [-0.0016, 0.0008] |
| flat-nearest3 | primary | 18 | sa | yieldImprovement | 106 | -67.7061 | [-235.2167, 67.5097] | [-108.5722, -9.6782] |
| flat-nearest3 | primary | 18 | sa | priceImprovement | 106 | -0.0022 | [-0.0083, 0.0037] | [-0.0041, -0.0007] |
| flat-nearest3 | primary | 24 | sa | yieldImprovement | 106 | -61.2549 | [-253.3357, 107.6245] | [-114.7205, 1.3511] |
| flat-nearest3 | primary | 24 | sa | priceImprovement | 106 | -0.0018 | [-0.0096, 0.0060] | [-0.0043, -0.0002] |
| flat-nearest3 | primary | 12 | sa-decay | yieldImprovement | 106 | -26.7020 | [-135.3416, 66.9282] | [-54.7704, 10.8827] |
| flat-nearest3 | primary | 12 | sa-decay | priceImprovement | 106 | -0.0006 | [-0.0044, 0.0034] | [-0.0019, 0.0004] |
| flat-nearest3 | primary | 18 | sa-decay | yieldImprovement | 106 | -70.7666 | [-235.0649, 63.4928] | [-111.3267, -14.8760] |
| flat-nearest3 | primary | 18 | sa-decay | priceImprovement | 106 | -0.0024 | [-0.0084, 0.0035] | [-0.0043, -0.0010] |
| flat-nearest3 | primary | 24 | sa-decay | yieldImprovement | 106 | -68.2648 | [-254.1298, 94.7923] | [-119.8889, -7.8257] |
| flat-nearest3 | primary | 24 | sa-decay | priceImprovement | 106 | -0.0023 | [-0.0099, 0.0053] | [-0.0047, -0.0007] |
| flat-nearest3 | ask | 12 | sa | yieldImprovement | 106 | -15.7587 | [-127.2842, 81.8638] | [-45.5033, 23.1391] |
| flat-nearest3 | ask | 12 | sa | priceImprovement | 106 | -0.0000 | [-0.0040, 0.0041] | [-0.0013, 0.0010] |
| flat-nearest3 | ask | 18 | sa | yieldImprovement | 106 | -58.5372 | [-226.0139, 77.3823] | [-99.8646, -1.1884] |
| flat-nearest3 | ask | 18 | sa | priceImprovement | 106 | -0.0018 | [-0.0078, 0.0042] | [-0.0036, -0.0002] |
| flat-nearest3 | ask | 24 | sa | yieldImprovement | 106 | -48.3726 | [-239.8911, 120.8922] | [-102.6343, 13.5187] |
| flat-nearest3 | ask | 24 | sa | priceImprovement | 106 | -0.0011 | [-0.0089, 0.0067] | [-0.0037, 0.0005] |
| flat-nearest3 | ask | 12 | sa-decay | yieldImprovement | 106 | -20.8877 | [-129.5193, 73.3567] | [-49.3764, 16.5777] |
| flat-nearest3 | ask | 12 | sa-decay | priceImprovement | 106 | -0.0003 | [-0.0042, 0.0037] | [-0.0016, 0.0007] |
| flat-nearest3 | ask | 18 | sa-decay | yieldImprovement | 106 | -61.4147 | [-224.8524, 72.8974] | [-102.4368, -6.1985] |
| flat-nearest3 | ask | 18 | sa-decay | priceImprovement | 106 | -0.0020 | [-0.0079, 0.0040] | [-0.0038, -0.0005] |
| flat-nearest3 | ask | 24 | sa-decay | yieldImprovement | 106 | -55.2050 | [-240.0455, 108.4029] | [-107.6291, 4.3881] |
| flat-nearest3 | ask | 24 | sa-decay | priceImprovement | 106 | -0.0016 | [-0.0091, 0.0060] | [-0.0040, 0.0000] |
| flat-nearest3 | bid | 12 | sa | yieldImprovement | 106 | -27.6340 | [-140.7519, 69.1426] | [-56.5632, 11.7130] |
| flat-nearest3 | bid | 12 | sa | priceImprovement | 106 | -0.0006 | [-0.0046, 0.0035] | [-0.0019, 0.0005] |
| flat-nearest3 | bid | 18 | sa | yieldImprovement | 106 | -76.8750 | [-245.9051, 59.1801] | [-117.2798, -18.1681] |
| flat-nearest3 | bid | 18 | sa | priceImprovement | 106 | -0.0027 | [-0.0087, 0.0032] | [-0.0046, -0.0012] |
| flat-nearest3 | bid | 24 | sa | yieldImprovement | 106 | -74.1371 | [-267.4191, 93.5684] | [-126.8068, -10.8165] |
| flat-nearest3 | bid | 24 | sa | priceImprovement | 106 | -0.0025 | [-0.0103, 0.0052] | [-0.0050, -0.0009] |
| flat-nearest3 | bid | 12 | sa-decay | yieldImprovement | 106 | -32.5163 | [-142.1524, 60.8212] | [-60.1644, 5.1877] |
| flat-nearest3 | bid | 12 | sa-decay | priceImprovement | 106 | -0.0009 | [-0.0047, 0.0030] | [-0.0021, 0.0001] |
| flat-nearest3 | bid | 18 | sa-decay | yieldImprovement | 106 | -80.1184 | [-244.8549, 53.8740] | [-120.2165, -23.5534] |
| flat-nearest3 | bid | 18 | sa-decay | priceImprovement | 106 | -0.0029 | [-0.0089, 0.0029] | [-0.0048, -0.0015] |
| flat-nearest3 | bid | 24 | sa-decay | yieldImprovement | 106 | -81.3246 | [-270.0037, 81.1817] | [-132.1488, -20.0395] |
| flat-nearest3 | bid | 24 | sa-decay | priceImprovement | 106 | -0.0030 | [-0.0106, 0.0046] | [-0.0053, -0.0014] |
| flat-nearest3 | excludeShutdownSensitive | 12 | sa | yieldImprovement | 100 | -66.5671 | [-170.0089, 9.3579] | [-78.1238, -23.3423] |
| flat-nearest3 | excludeShutdownSensitive | 12 | sa | priceImprovement | 100 | -0.0026 | [-0.0058, 0.0003] | [-0.0031, -0.0015] |
| flat-nearest3 | excludeShutdownSensitive | 18 | sa | yieldImprovement | 100 | -132.1591 | [-293.5985, -11.8936] | [-147.9095, -67.9975] |
| flat-nearest3 | excludeShutdownSensitive | 18 | sa | priceImprovement | 100 | -0.0055 | [-0.0105, -0.0007] | [-0.0063, -0.0039] |
| flat-nearest3 | excludeShutdownSensitive | 24 | sa | yieldImprovement | 100 | -145.2817 | [-329.4974, -0.3109] | [-167.3064, -76.5619] |
| flat-nearest3 | excludeShutdownSensitive | 24 | sa | priceImprovement | 100 | -0.0062 | [-0.0127, 0.0003] | [-0.0073, -0.0045] |
| flat-nearest3 | excludeShutdownSensitive | 12 | sa-decay | yieldImprovement | 100 | -68.2859 | [-168.8355, 6.1236] | [-79.5370, -26.7229] |
| flat-nearest3 | excludeShutdownSensitive | 12 | sa-decay | priceImprovement | 100 | -0.0027 | [-0.0059, 0.0002] | [-0.0032, -0.0016] |
| flat-nearest3 | excludeShutdownSensitive | 18 | sa-decay | yieldImprovement | 100 | -134.3592 | [-290.1640, -17.3118] | [-149.6851, -72.6205] |
| flat-nearest3 | excludeShutdownSensitive | 18 | sa-decay | priceImprovement | 100 | -0.0057 | [-0.0106, -0.0009] | [-0.0064, -0.0041] |
| flat-nearest3 | excludeShutdownSensitive | 24 | sa-decay | yieldImprovement | 100 | -147.7550 | [-328.1291, -5.2785] | [-169.2829, -81.3776] |
| flat-nearest3 | excludeShutdownSensitive | 24 | sa-decay | priceImprovement | 100 | -0.0064 | [-0.0128, -0.0000] | [-0.0075, -0.0048] |
| svensson | primary | 12 | sa | yieldImprovement | 106 | 404.2902 | [-257.9909, 1719.6968] | [-91.2582, 498.5391] |
| svensson | primary | 12 | sa | priceImprovement | 106 | 0.0084 | [-0.0104, 0.0412] | [-0.0038, 0.0121] |
| svensson | primary | 18 | sa | yieldImprovement | 106 | -39.6572 | [-2151.7238, 2206.0311] | [-805.1171, 548.7926] |
| svensson | primary | 18 | sa | priceImprovement | 106 | -0.0099 | [-0.0979, 0.0669] | [-0.0332, 0.0175] |
| svensson | primary | 24 | sa | yieldImprovement | 106 | 3214.1379 | [23.2357, 8479.5325] | [2250.6834, 3743.2404] |
| svensson | primary | 24 | sa | priceImprovement | 106 | 0.1083 | [-0.0071, 0.3040] | [0.0739, 0.1276] |
| svensson | primary | 12 | sa-decay | yieldImprovement | 106 | 1037.2464 | [-13.6867, 3711.0911] | [12.7267, 1147.6843] |
| svensson | primary | 12 | sa-decay | priceImprovement | 106 | 0.0266 | [-0.0006, 0.0952] | [0.0004, 0.0295] |
| svensson | primary | 18 | sa-decay | yieldImprovement | 106 | -937.9959 | [-2740.7466, 93.7866] | [-1027.4403, -332.6216] |
| svensson | primary | 18 | sa-decay | priceImprovement | 106 | -0.0403 | [-0.1231, 0.0053] | [-0.0445, -0.0122] |
| svensson | primary | 24 | sa-decay | yieldImprovement | 106 | 3333.0772 | [-1678.2345, 10256.8726] | [1928.5541, 4413.2107] |
| svensson | primary | 24 | sa-decay | priceImprovement | 106 | 0.0924 | [-0.1017, 0.3414] | [0.0443, 0.1429] |
| svensson | ask | 12 | sa | yieldImprovement | 106 | -91.6064 | [-325.6641, 25.5947] | [-106.0206, 6.8028] |
| svensson | ask | 12 | sa | priceImprovement | 106 | -0.0038 | [-0.0129, 0.0012] | [-0.0045, 0.0000] |
| svensson | ask | 18 | sa | yieldImprovement | 106 | 513.6459 | [-660.1965, 2495.6856] | [-198.8654, 796.3650] |
| svensson | ask | 18 | sa | priceImprovement | 106 | 0.0169 | [-0.0255, 0.0821] | [-0.0051, 0.0283] |
| svensson | ask | 24 | sa | yieldImprovement | 106 | 2279.3151 | [42.7425, 6061.6860] | [1404.0011, 2640.2214] |
| svensson | ask | 24 | sa | priceImprovement | 106 | 0.0785 | [-0.0002, 0.2160] | [0.0469, 0.0916] |
| svensson | ask | 12 | sa-decay | yieldImprovement | 106 | 1446.8033 | [-20.1253, 5246.1483] | [-5.5326, 1601.0644] |
| svensson | ask | 12 | sa-decay | priceImprovement | 106 | 0.0386 | [-0.0008, 0.1403] | [-0.0002, 0.0428] |
| svensson | ask | 18 | sa-decay | yieldImprovement | 106 | -1297.1075 | [-4686.8762, 177.5629] | [-1409.5376, -65.7679] |
| svensson | ask | 18 | sa-decay | priceImprovement | 106 | -0.0436 | [-0.1600, 0.0112] | [-0.0470, -0.0004] |
| svensson | ask | 24 | sa-decay | yieldImprovement | 106 | 1954.1018 | [-1854.6011, 7611.1158] | [739.1180, 2672.8499] |
| svensson | ask | 24 | sa-decay | priceImprovement | 106 | 0.0642 | [-0.0697, 0.2573] | [0.0279, 0.0862] |
| svensson | bid | 12 | sa | yieldImprovement | 106 | 900.1868 | [-251.5687, 3534.4726] | [-90.9939, 1001.3089] |
| svensson | bid | 12 | sa | priceImprovement | 106 | 0.0206 | [-0.0103, 0.0858] | [-0.0039, 0.0241] |
| svensson | bid | 18 | sa | yieldImprovement | 106 | -592.9603 | [-4158.4922, 2092.9007] | [-1411.3688, 593.8584] |
| svensson | bid | 18 | sa | priceImprovement | 106 | -0.0368 | [-0.1947, 0.0633] | [-0.0614, 0.0186] |
| svensson | bid | 24 | sa | yieldImprovement | 106 | 4148.9607 | [-161.4890, 11169.7380] | [3097.3657, 4846.2594] |
| svensson | bid | 24 | sa | priceImprovement | 106 | 0.1381 | [-0.0230, 0.4012] | [0.0995, 0.1635] |
| svensson | bid | 12 | sa-decay | yieldImprovement | 106 | 627.6894 | [-12.8062, 2171.9930] | [30.9860, 694.3042] |
| svensson | bid | 12 | sa-decay | priceImprovement | 106 | 0.0147 | [-0.0006, 0.0501] | [0.0009, 0.0162] |
| svensson | bid | 18 | sa-decay | yieldImprovement | 106 | -578.8843 | [-4121.7264, 1868.0931] | [-1268.1146, 630.1406] |
| svensson | bid | 18 | sa-decay | priceImprovement | 106 | -0.0370 | [-0.1939, 0.0560] | [-0.0580, 0.0193] |
| svensson | bid | 24 | sa-decay | yieldImprovement | 106 | 4712.0526 | [-2330.2006, 13586.7973] | [2911.1579, 6456.1009] |
| svensson | bid | 24 | sa-decay | priceImprovement | 106 | 0.1207 | [-0.1512, 0.4377] | [0.0603, 0.2006] |
| svensson | excludeShutdownSensitive | 12 | sa | yieldImprovement | 100 | 426.2948 | [-304.8686, 1819.3882] | [-105.0116, 540.8827] |
| svensson | excludeShutdownSensitive | 12 | sa | priceImprovement | 100 | 0.0087 | [-0.0123, 0.0433] | [-0.0045, 0.0131] |
| svensson | excludeShutdownSensitive | 18 | sa | yieldImprovement | 100 | -227.2023 | [-2434.6196, 2364.0548] | [-1054.6780, 497.8209] |
| svensson | excludeShutdownSensitive | 18 | sa | priceImprovement | 100 | -0.0200 | [-0.1141, 0.0729] | [-0.0452, 0.0138] |
| svensson | excludeShutdownSensitive | 24 | sa | yieldImprovement | 100 | 2970.7908 | [-341.9987, 8525.8226] | [2085.0066, 3583.4243] |
| svensson | excludeShutdownSensitive | 24 | sa | priceImprovement | 100 | 0.0961 | [-0.0200, 0.3018] | [0.0645, 0.1182] |
| svensson | excludeShutdownSensitive | 12 | sa-decay | yieldImprovement | 100 | 1121.2753 | [-6.7269, 3873.0490] | [22.8692, 1256.4718] |
| svensson | excludeShutdownSensitive | 12 | sa-decay | priceImprovement | 100 | 0.0289 | [-0.0003, 0.0999] | [0.0007, 0.0324] |
| svensson | excludeShutdownSensitive | 18 | sa-decay | yieldImprovement | 100 | -1191.2275 | [-3309.3202, 28.3706] | [-1291.9131, -445.3983] |
| svensson | excludeShutdownSensitive | 18 | sa-decay | priceImprovement | 100 | -0.0523 | [-0.1494, 0.0019] | [-0.0566, -0.0176] |
| svensson | excludeShutdownSensitive | 24 | sa-decay | yieldImprovement | 100 | 2995.0492 | [-2106.9242, 10874.4782] | [1703.4064, 4292.2810] |
| svensson | excludeShutdownSensitive | 24 | sa-decay | priceImprovement | 100 | 0.0735 | [-0.1348, 0.3523] | [0.0292, 0.1341] |

## Influential episodes: 6–12 months, full SA, price improvement

Top three episodes by absolute change in the carry-gap slope after deleting that episode, separately for each reference and training cutoff. No episodes are excluded from primary scores.
Episode labels can precede the observation range: the December 2014 CPI release governs the January 9, 2015 pre-release observation. No pre-2015 quotes are used.
Mean contribution is episode improvement divided by episode count. Slope contribution sums to the full slope, but can have either sign; it is not a fraction of causal explanation.
Influence is diagnostic, not a reason to discard an episode. A changed sign on deletion is marked explicitly.

| Reference | Cutoff | Episode | Observation dates | Largest raw pair (date / side / CUSIP) | Carry gap pp | Mean contribution | Full slope | Without episode | Slope flips |
|---|---:|---|---|---|---:|---:|---:|---:|---|
| flat-nearest3 | 12 | 2026-05-12 | 2026-05-19;2026-06-03 | 2026-05-19 / ask / 912810PS1 | 7.3887 | 0.0018 | -0.0003 | -0.0016 | false |
| flat-nearest3 | 12 | 2014-12-17 | 2015-01-09 | 2015-01-09 / bid / 912828EA4 | -6.0743 | 0.0018 | -0.0003 | 0.0008 | true |
| flat-nearest3 | 12 | 2026-04-10 | 2026-04-17;2026-05-05 | 2026-05-05 / ask / 912810PS1 | 7.0710 | 0.0013 | -0.0003 | -0.0012 | false |
| flat-nearest3 | 18 | 2026-05-12 | 2026-05-19;2026-06-03 | 2026-05-19 / ask / 912810PS1 | 7.3887 | 0.0025 | -0.0022 | -0.0041 | false |
| flat-nearest3 | 18 | 2014-12-17 | 2015-01-09 | 2015-01-09 / bid / 912828EA4 | -6.0743 | 0.0027 | -0.0022 | -0.0007 | false |
| flat-nearest3 | 18 | 2026-04-10 | 2026-04-17;2026-05-05 | 2026-05-05 / ask / 912810PS1 | 7.0710 | 0.0017 | -0.0022 | -0.0035 | false |
| flat-nearest3 | 24 | 2026-05-12 | 2026-05-19;2026-06-03 | 2026-05-19 / ask / 912810PS1 | 7.3887 | 0.0034 | -0.0018 | -0.0043 | false |
| flat-nearest3 | 24 | 2026-04-10 | 2026-04-17;2026-05-05 | 2026-05-05 / ask / 912810PS1 | 7.0710 | 0.0025 | -0.0018 | -0.0035 | false |
| flat-nearest3 | 24 | 2014-12-17 | 2015-01-09 | 2015-01-09 / bid / 912828EA4 | -6.0743 | 0.0030 | -0.0018 | -0.0002 | false |
| svensson | 12 | 2019-09-12 | 2019-09-19;2019-10-03 | 2019-10-03 / bid / 912828K33 | -1.8155 | -0.0659 | 0.0084 | -0.0038 | true |
| svensson | 12 | 2019-05-10 | 2019-05-17;2019-06-05 | 2019-06-05 / ask / 912828MF4 | 4.8522 | -0.0079 | 0.0084 | 0.0121 | false |
| svensson | 12 | 2015-01-16 | 2015-01-26;2015-02-19 | 2015-02-19 / bid / 912828ET3 | -7.0929 | 0.0007 | 0.0084 | 0.0099 | false |
| svensson | 18 | 2016-07-15 | 2016-07-22;2016-08-09 | 2016-08-09 / bid / 912828SQ4 | 2.8857 | -0.1012 | -0.0099 | 0.0175 | true |
| svensson | 18 | 2016-08-16 | 2016-08-23;2016-09-09 | 2016-09-09 / bid / 912828SQ4 | -2.0027 | -0.1160 | -0.0099 | -0.0332 | false |
| svensson | 18 | 2019-05-10 | 2019-05-17;2019-06-05 | 2019-06-05 / bid / 912828MF4 | 4.8522 | -0.0252 | -0.0099 | 0.0004 | true |
| svensson | 24 | 2016-11-17 | 2016-11-25;2016-12-08 | 2016-11-25 / bid / 912828GX2 | -0.6651 | -0.4851 | 0.1083 | 0.0739 | false |
| svensson | 24 | 2016-10-18 | 2016-10-25;2016-11-09 | 2016-11-09 / bid / 912828GX2 | -0.3504 | -0.6474 | 0.1083 | 0.0817 | false |
| svensson | 24 | 2016-09-16 | 2016-09-23;2016-10-11 | 2016-09-23 / bid / 912828SQ4 | -1.9648 | -0.1225 | 0.1083 | 0.0868 | false |

## Scope and next experiments

The [summary](./carry-flat-summary.csv) includes every maturity bucket, regime, reference cutoff, and side/shutdown sensitivity.
The [paired observations](./carry-flat-pairs.csv) retain unknown-inflation days for subsequent conditional/horizon plots.
The [relationships](./carry-flat-relationships.csv) report descriptive univariate slopes; these do not control for maturity, season, or macro regime.
The [influence table](./carry-flat-influence.csv) identifies every episode's contribution and leave-one-out mean/slope, for both families when the independent benchmark is run.
A nonnegative slope, reference-sensitive sign, or interval spanning zero weakens the simple proposed mechanism.
The flat benchmark changes both the curve family and training breadth (three nearest bonds versus the full longer-end universe). Differences cannot be attributed solely to curve family. Neither reference is an observed true short-end curve.
Next: coherent trend-carry counterfactual; matched-bond/common-start release decomposition; prospective validation. These are not implemented here.
See [the hypothesis and experiment design](../../CPI-HYPOTHESIS.md).
