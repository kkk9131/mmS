import React from 'react';
import { FlatList, FlatListProps } from 'react-native';

interface LazyPostListProps<T> extends FlatListProps<T> {
  data: T[];
}

export function LazyPostList<T>({ data, ...props }: LazyPostListProps<T>) {
  return (
    <FlatList
      data={data}
      {...props}
    />
  );
}

export default LazyPostList;