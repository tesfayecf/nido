# TODO: Define the commands to start the garage server, create buckets, keys, etc.

# ./../third-party/garage/garage -c ./config/garage.toml status
# ./../third-party/garage/garage -c ./config/garage.toml layout assign -z dc1 -c 1G <NODE_ID>
# ./../third-party/garage/garage -c ./config/garage.toml layout apply --version 1
# ./../third-party/garage/garage -c ./config/garage.toml key create hs-dev
# ./../third-party/garage/garage -c ./config/garage.toml bucket create hs-dev
# ./../third-party/garage/garage -c ./config/garage.toml bucket allow --read --write --owner hs-dev --key hs-dev
