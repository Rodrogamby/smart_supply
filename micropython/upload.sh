#!/bin/bash

if [ "$1" != "" ]; then
  for i in $(cat "files.txt")
  do
    eval "echo \"Uploading $i to /dev/tty$1...\""
    eval "ampy -p $1 put $i"
  done
else
  printf "Usage: upload.sh [port]\nExample: upload.sh /dev/ttyACM0\n"
fi
