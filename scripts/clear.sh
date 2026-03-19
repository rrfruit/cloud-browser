#!/bin/bash

# 清理所有node_modules
rm -rf ./apps/*/node_modules
rm -rf ./packages/*/node_modules
rm -rf node_modules

# 清理所有dist
rm -rf ./apps/*/dist
rm -rf ./packages/*/dist
rm -rf dist
