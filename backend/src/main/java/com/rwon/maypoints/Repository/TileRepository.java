package com.rwon.maypoints.Repository;

import com.rwon.maypoints.Entities.Tile;
import com.rwon.maypoints.Entities.Waypoint;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TileRepository  extends MongoRepository<Tile, String> {
    boolean existsByXAndZ(int x, int z);
}
