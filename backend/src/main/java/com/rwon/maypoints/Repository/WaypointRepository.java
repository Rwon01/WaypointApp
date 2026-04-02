package com.rwon.maypoints.Repository;

import com.rwon.maypoints.Entities.Waypoint;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface WaypointRepository extends MongoRepository<Waypoint, String> {

}
