for fund in VYFXX; do
#for fund in VUSXX VMSXX VMRXX VMFXX VCTXX VYFXX; do
    echo Processing $fund...
    ../lib/nasdaq-update-common-job.sh -b $fund -nodearg $fund -pubdelay 18 -rundelay 4 "$@"
    echo
done